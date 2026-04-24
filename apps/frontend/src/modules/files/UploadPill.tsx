// Floating upload queue in the bottom-right. Live state from lib/upload.
// Collapsed view shows "Uploading X · Y%"; click to expand the per-file list.

import { useMemo, useState } from "react";
import { useUploads, formatBytes, type UploadJob } from "@/lib/upload";
import { Icon } from "@/components/Icons";

function statusChip(j: UploadJob) {
  switch (j.status) {
    case "hashing":
      return (
        <span className="chip">
          <span className="dot" /> HASHING
        </span>
      );
    case "initiating":
    case "assembling":
      return (
        <span className="chip warn">
          <span className="dot" /> {j.status.toUpperCase()}
        </span>
      );
    case "uploading":
      return (
        <span className="chip warn">
          <span className="dot" /> {Math.floor(j.progress * 100)}%
        </span>
      );
    case "paused":
      return (
        <span className="chip">
          <span className="dot" /> PAUSED
        </span>
      );
    case "complete":
      return (
        <span className="chip success">
          <span className="dot" /> VERIFIED
        </span>
      );
    case "canceled":
      return (
        <span className="chip">
          <span className="dot" /> CANCELED
        </span>
      );
    case "error":
      return (
        <span className="chip danger">
          <span className="dot" /> ERROR
        </span>
      );
  }
}

export function UploadPill() {
  const jobs = useUploads((s) => s.jobs);
  const pause = useUploads((s) => s.pause);
  const resume = useUploads((s) => s.resume);
  const cancel = useUploads((s) => s.cancel);
  const dismiss = useUploads((s) => s.dismiss);
  const [open, setOpen] = useState(false);

  const list = useMemo(() => Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt), [jobs]);
  const active = list.filter((j) => j.status === "uploading" || j.status === "hashing" || j.status === "initiating" || j.status === "assembling");

  if (list.length === 0) return null;

  const overall =
    active.length > 0
      ? Math.floor((active.reduce((a, j) => a + j.progress, 0) / active.length) * 100)
      : 100;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: open ? 380 : 260,
        background: "var(--paper-0)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "var(--sh-2)",
        zIndex: 150,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          borderBottom: open ? "1px solid var(--border-soft)" : 0,
          background: "var(--paper-0)",
        }}
      >
        <Icon.upload size={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13px/1 var(--font-sans)" }}>
            {active.length > 0 ? `Uploading ${active.length} of ${list.length}` : `${list.length} upload${list.length > 1 ? "s" : ""}`}
          </div>
          <div className="caseno" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
            {active.length > 0 ? `${overall}% · chain verifying` : "done"}
          </div>
        </div>
        <Icon.chevR style={{ transform: open ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 140ms" }} size={16} />
      </div>

      {open && (
        <div style={{ maxHeight: 320, overflow: "auto" }}>
          {list.map((j) => (
            <div key={j.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 5,
                    background: "var(--ember-500)",
                    color: "#fff",
                    font: "700 9px/28px var(--font-mono)",
                    textAlign: "center",
                  }}
                >
                  {(j.mime.split("/")[1] ?? "BIN").slice(0, 3).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "500 12px/1.2 var(--font-sans)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {j.fileName}
                  </div>
                  <div className="caseno" style={{ marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                    {formatBytes(j.uploadedBytes)} / {formatBytes(j.size)}
                    {j.status === "uploading" && j.speedBps > 0 ? ` · ${formatBytes(j.speedBps)}/s` : ""}
                  </div>
                </div>
                {statusChip(j)}
              </div>
              <div style={{ height: 3, background: "var(--paper-200)", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.floor(j.progress * 100)}%`,
                    height: "100%",
                    background: j.status === "error" ? "var(--blood-500)" : "var(--ember-500)",
                    transition: "width 160ms",
                  }}
                />
              </div>
              {j.error && (
                <div style={{ marginTop: 6, color: "var(--fg-danger)", font: "400 11px/1.3 var(--font-sans)" }}>{j.error}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {j.status === "uploading" && (
                  <button className="btn btn-ghost" style={{ padding: "3px 8px" }} onClick={() => pause(j.id)}>
                    <Icon.pause size={12} /> Pause
                  </button>
                )}
                {j.status === "paused" && (
                  <button className="btn btn-secondary" style={{ padding: "3px 8px" }} onClick={() => void resume(j.id)}>
                    <Icon.play size={12} /> Resume
                  </button>
                )}
                {(j.status === "uploading" || j.status === "paused" || j.status === "initiating" || j.status === "hashing") && (
                  <button className="btn btn-ghost" style={{ padding: "3px 8px" }} onClick={() => void cancel(j.id)}>
                    Cancel
                  </button>
                )}
                {(j.status === "complete" || j.status === "error" || j.status === "canceled") && (
                  <button className="btn btn-ghost" style={{ padding: "3px 8px", marginLeft: "auto" }} onClick={() => dismiss(j.id)}>
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
