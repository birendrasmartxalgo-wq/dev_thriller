// Migrated from app/files.jsx — Files table + detail rail.
// Data source: not yet a /files list endpoint; we feed this from the Search API
// with an empty query limited to this workspace + the upload queue. This matches
// the PRD target of a unified search-first files experience.

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fileApi, searchApi } from "@/api/endpoints";
import { useSession } from "@/store/session";
import { useUploads, formatBytes } from "@/lib/upload";
import { Icon } from "@/components/Icons";
import { toast } from "@/store/toast";

type FilterKey = "all" | "uploading" | "locked";

export function FilesView() {
  const activeWs = useSession((s) => s.activeWorkspaceId);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const enqueue = useUploads((s) => s.enqueue);
  const jobs = useUploads((s) => s.jobs);
  const inputRef = useRef<HTMLInputElement>(null);

  const filesQuery = useQuery({
    queryKey: ["files-search", activeWs, q],
    queryFn: () => searchApi.query({ q: q || "*", workspaceId: activeWs!, type: "file", limit: 100 }),
    enabled: Boolean(activeWs),
  });

  const detailQuery = useQuery({
    queryKey: ["file", selectedId],
    queryFn: () => fileApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const uploadingJobs = useMemo(() => Object.values(jobs).filter((j) => j.workspaceId === activeWs), [jobs, activeWs]);

  function handleFiles(files: FileList | null) {
    if (!files || !activeWs) return;
    for (const f of Array.from(files)) {
      if (f.size > 1024 * 1024 * 1024) {
        toast(`${f.name} is over the 1 GB cap`, "error");
        continue;
      }
      enqueue(f, activeWs);
    }
  }

  const allRows = useMemo(() => {
    const apiRows = (filesQuery.data?.files ?? []).map((f) => ({
      key: f.id,
      id: f.id,
      name: f.name,
      mime: f.mime,
      size: f.sizeBytes,
      status: "verified" as const,
      when: new Date(f.createdAt).toLocaleString(),
      hash: "",
    }));
    const uploadingRows = uploadingJobs
      .filter((j) => j.status !== "complete" && j.status !== "canceled")
      .map((j) => ({
        key: `job:${j.id}`,
        id: null,
        name: j.fileName,
        mime: j.mime,
        size: j.size,
        status: j.status === "error" ? ("error" as const) : ("uploading" as const),
        pct: Math.floor(j.progress * 100),
        when: "just now",
        hash: "",
      }));
    return [...uploadingRows, ...apiRows].filter((r) => {
      if (filter === "uploading" && r.status !== "uploading") return false;
      if (filter === "locked" && r.status !== "verified") return false;
      return true;
    });
  }, [filesQuery.data, uploadingJobs, filter]);

  const kindOf = (mime: string) => (mime.split("/")[1] ?? "BIN").slice(0, 3).toUpperCase();
  const colorFor = (mime: string) => {
    if (mime.startsWith("video/")) return "var(--blood-500)";
    if (mime.startsWith("image/")) return "var(--lav-500)";
    if (mime.startsWith("audio/")) return "var(--mint-500)";
    if (mime.includes("pdf")) return "var(--blood-700)";
    if (mime.includes("zip") || mime.includes("archive")) return "var(--ink-500)";
    return "var(--ember-500)";
  };

  const totalSize = allRows.reduce((a, r) => a + r.size, 0);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="page-head">
        <div className="title-block">
          <div className="caseno">CASE · FILES</div>
          <h1>
            Files
            <span style={{ color: "var(--fg3)", fontWeight: 400, fontSize: 14, marginLeft: 6, fontFamily: "var(--font-mono)" }}>
              {allRows.length} items · {formatBytes(totalSize)}
            </span>
          </h1>
        </div>
        <input className="input" placeholder="Search files…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        <div className="seg">
          {(
            [
              ["all", "All"],
              ["uploading", "Uploading"],
              ["locked", "Locked"],
            ] as [FilterKey, string][]
          ).map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          <Icon.upload size={14} /> Upload
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: selectedId ? "1fr 360px" : "1fr", minHeight: 0 }}>
        <div style={{ overflow: "auto", padding: "12px 24px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", font: "400 13px/1.3 var(--font-sans)" }}>
            <thead>
              <tr>
                {["Name", "Size", "Status", "Modified", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      font: "500 10px/1 var(--font-mono)",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "var(--fg3)",
                      padding: "0 10px 8px",
                      borderBottom: "1px solid var(--border-soft)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((r) => (
                <tr
                  key={r.key}
                  onClick={() => r.id && setSelectedId(r.id)}
                  style={{ cursor: r.id ? "pointer" : "default", background: selectedId === r.id ? "var(--ember-50)" : "transparent" }}
                >
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 5,
                          background: colorFor(r.mime),
                          color: "#fff",
                          font: "700 9px/30px var(--font-mono)",
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        {kindOf(r.mime)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{r.name}</span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: 10,
                      borderBottom: "1px solid var(--border-soft)",
                      color: "var(--fg2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {formatBytes(r.size)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border-soft)" }}>
                    {r.status === "uploading" ? (
                      <span className="chip warn">
                        <span className="dot" />
                        {"pct" in r ? r.pct : 0}%
                      </span>
                    ) : r.status === "error" ? (
                      <span className="chip danger">
                        <span className="dot" />
                        ERROR
                      </span>
                    ) : (
                      <span className="chip success">
                        <span className="dot" />
                        VERIFIED
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border-soft)", color: "var(--fg3)" }}>{r.when}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border-soft)", textAlign: "right" }}>
                    <button className="tb-btn">
                      <Icon.moreH size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {allRows.length === 0 && !filesQuery.isLoading && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <div className="title">No files yet.</div>
                      <div className="sub">Drag a file here, or hit Upload. Every chunk is sha256-verified.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedId && detailQuery.data && (
          <div style={{ borderLeft: "1px solid var(--border-soft)", background: "var(--paper-0)", padding: 16, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>File details</strong>
              <div style={{ flex: 1 }} />
              <button className="tb-btn" onClick={() => setSelectedId(null)}>
                <Icon.x size={14} />
              </button>
            </div>
            <div
              style={{
                marginTop: 14,
                aspectRatio: "4/3",
                borderRadius: 10,
                background: "linear-gradient(135deg, #1E2247, #5E3DC7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "rgba(255,253,248,.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-900)",
                }}
              >
                <Icon.play size={18} />
              </div>
            </div>
            <div style={{ font: "600 16px/1.2 var(--font-sans)", marginTop: 14 }}>{detailQuery.data.name}</div>
            <div className="caseno" style={{ marginTop: 6 }}>
              {formatBytes(detailQuery.data.sizeBytes).toUpperCase()} · {new Date(detailQuery.data.createdAt).toLocaleString().toUpperCase()}
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {[
                ["Mime", detailQuery.data.mime],
                ["sha256", detailQuery.data.checksum],
                ["Version", `v${detailQuery.data.version}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 10 }}>
                  <span style={{ color: "var(--fg3)" }}>{k}</span>
                  <span
                    style={{
                      fontFamily: k === "sha256" ? "var(--font-mono)" : "inherit",
                      textAlign: "right",
                      wordBreak: "break-all",
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              <a href={detailQuery.data.url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                <Icon.download size={14} /> Download
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(detailQuery.data!.url);
                  toast("Signed URL copied (valid 15 min)");
                }}
              >
                <Icon.link size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
