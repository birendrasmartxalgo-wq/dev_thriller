// Chunked upload state machine.
//
// 1. Compute SHA-256 of the whole file via WebCrypto (ok up to ~1 GB in-memory).
// 2. POST /v1/uploads → get { uploadId, chunkSize, chunkUrls[] }.
// 3. PUT each chunk to its signed R2 URL with 4-way parallelism, 2^n backoff.
//    After each successful PUT, POST /v1/uploads/:id/chunks/:idx with { etag, size }.
// 4. POST /v1/uploads/:id/complete → get { fileId }.
// Supports pause/resume via simple abort-flag; cancel + abort R2 multipart via DELETE.
//
// Exposed via a Zustand store so the UploadPill and other views can observe state.

import { create } from "zustand";
import { fileApi } from "@/api/endpoints";
import { ApiError, tokenStore } from "@/api/client";

const MAX_PARALLEL = 4;
const MAX_RETRIES = 5;

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type UploadStatus = "hashing" | "initiating" | "uploading" | "assembling" | "complete" | "error" | "paused" | "canceled";

export interface UploadJob {
  id: string; // local id
  fileName: string;
  mime: string;
  size: number;
  workspaceId: string;
  status: UploadStatus;
  error?: string;
  uploadId?: string;
  fileId?: string; // set on success
  progress: number; // 0..1
  speedBps: number; // rolling bytes/s
  uploadedBytes: number;
  totalChunks: number;
  completedChunks: number;
  startedAt: number;
  pausedAt?: number;
  file: File;
  // internal — imperative control
  _abort: AbortController;
  _paused: boolean;
}

interface UploadState {
  jobs: Record<string, UploadJob>;
  enqueue(file: File, workspaceId: string): string;
  pause(id: string): void;
  resume(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  dismiss(id: string): void;
}

let seq = 0;

async function putWithRetry(url: string, body: ArrayBuffer, signal: AbortSignal): Promise<Response> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= MAX_RETRIES) {
    try {
      const r = await fetch(url, { method: "PUT", body, signal });
      if (r.ok) return r;
      if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
        throw new Error(`R2 PUT ${r.status}`);
      }
      lastErr = new Error(`R2 PUT ${r.status}`);
    } catch (err) {
      if (signal.aborted) throw err;
      lastErr = err;
    }
    attempt++;
    await new Promise((res) => setTimeout(res, 250 * 2 ** attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error("put failed");
}

async function runJob(id: string, set: (fn: (s: UploadState) => UploadState) => void) {
  const get = () => useUploads.getState().jobs[id];
  const patch = (p: Partial<UploadJob>) =>
    set((s) => (s.jobs[id] ? { ...s, jobs: { ...s.jobs, [id]: { ...s.jobs[id]!, ...p } } } : s));

  try {
    const job0 = get();
    if (!job0) return;
    patch({ status: "hashing" });
    const checksum = await sha256Hex(job0.file);

    patch({ status: "initiating" });
    const init = await fileApi.initUpload({
      workspaceId: job0.workspaceId,
      filename: job0.file.name,
      mime: job0.file.type || "application/octet-stream",
      size: job0.file.size,
      checksum,
    });
    patch({ uploadId: init.uploadId, totalChunks: init.totalChunks, status: "uploading" });

    const chunkSize = init.chunkSize;
    const parts: { n: number; url: string; offset: number; size: number }[] = init.chunkUrls.map((u) => ({
      n: u.n,
      url: u.url,
      offset: (u.n - 1) * chunkSize,
      size: Math.min(chunkSize, job0.file.size - (u.n - 1) * chunkSize),
    }));

    let inFlight = 0;
    let cursor = 0;
    let uploaded = 0;
    let completedChunks = 0;
    const tick = Date.now();

    await new Promise<void>((resolve, reject) => {
      const pump = () => {
        const job = get();
        if (!job) return;
        if (job._abort.signal.aborted) return reject(new Error("aborted"));
        if (job._paused) return;
        while (inFlight < MAX_PARALLEL && cursor < parts.length) {
          const part = parts[cursor++]!;
          inFlight++;
          (async () => {
            const blob = job.file.slice(part.offset, part.offset + part.size);
            const buf = await blob.arrayBuffer();
            const r = await putWithRetry(part.url, buf, job._abort.signal);
            const etag = (r.headers.get("etag") ?? "").replace(/"/g, "");
            await fileApi.ackChunk(job.uploadId!, part.n, { etag, size: part.size });
            uploaded += part.size;
            completedChunks++;
            const elapsed = Math.max(1, Date.now() - tick);
            patch({
              uploadedBytes: uploaded,
              progress: uploaded / job.size,
              speedBps: (uploaded * 1000) / elapsed,
              completedChunks,
            });
          })()
            .catch((err) => reject(err))
            .finally(() => {
              inFlight--;
              if (cursor >= parts.length && inFlight === 0) resolve();
              else pump();
            });
        }
      };
      // Kick off; and also re-pump when resume() clears _paused.
      const poll = setInterval(() => {
        if (!get()) {
          clearInterval(poll);
          return;
        }
        pump();
        if (cursor >= parts.length && inFlight === 0) clearInterval(poll);
      }, 120);
      pump();
    });

    const job1 = get();
    if (!job1) return;
    patch({ status: "assembling" });
    const done = await fileApi.complete(job1.uploadId!);
    patch({ status: "complete", fileId: done.fileId, progress: 1 });
  } catch (err) {
    const job = get();
    if (!job) return;
    if (job._abort.signal.aborted) patch({ status: "canceled" });
    else patch({ status: "error", error: err instanceof ApiError ? err.message : String((err as Error).message ?? err) });
  }
}

export const useUploads = create<UploadState>((set, _get) => ({
  jobs: {},
  enqueue(file, workspaceId) {
    const id = `u${++seq}`;
    const job: UploadJob = {
      id,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      workspaceId,
      status: "hashing",
      progress: 0,
      speedBps: 0,
      uploadedBytes: 0,
      totalChunks: 0,
      completedChunks: 0,
      startedAt: Date.now(),
      file,
      _abort: new AbortController(),
      _paused: false,
    };
    set((s) => ({ ...s, jobs: { ...s.jobs, [id]: job } }));
    // Kick off async; state transitions happen inside runJob.
    void runJob(id, set as (fn: (s: UploadState) => UploadState) => void);
    return id;
  },
  pause(id) {
    const job = _get().jobs[id];
    if (!job) return;
    job._paused = true;
    job.pausedAt = Date.now();
    set((s) => ({ ...s, jobs: { ...s.jobs, [id]: { ...s.jobs[id]!, status: "paused" } } }));
  },
  async resume(id) {
    const job = _get().jobs[id];
    if (!job) return;
    job._paused = false;
    set((s) => ({ ...s, jobs: { ...s.jobs, [id]: { ...s.jobs[id]!, status: "uploading", pausedAt: undefined } } }));
  },
  async cancel(id) {
    const job = _get().jobs[id];
    if (!job) return;
    job._abort.abort();
    if (job.uploadId) {
      const access = tokenStore.access;
      try {
        await fetch(`/v1/uploads/${job.uploadId}`, {
          method: "DELETE",
          headers: access ? { Authorization: `Bearer ${access}` } : {},
        });
      } catch {
        /* ignore */
      }
    }
    set((s) => ({ ...s, jobs: { ...s.jobs, [id]: { ...s.jobs[id]!, status: "canceled" } } }));
  },
  dismiss(id) {
    set((s) => {
      const next = { ...s.jobs };
      delete next[id];
      return { ...s, jobs: next };
    });
  },
}));

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
