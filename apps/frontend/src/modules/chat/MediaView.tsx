// Chat media rail — grid of recent media in a chat, driven by /v1/chats/:id/media.
// Renders as a right-side panel inside ChatView, or as its own route.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatApi } from "@/api/endpoints";
import { Icon } from "@/components/Icons";
import { formatBytes } from "@/lib/upload";

type Kind = "image" | "video" | "doc" | "audio" | "link";

export function MediaView({ chatId, onClose }: { chatId: string; onClose?: () => void }) {
  const [kind, setKind] = useState<Kind | "all">("all");

  const mediaQuery = useQuery({
    queryKey: ["media", chatId, kind],
    queryFn: () => chatApi.media(chatId, { kind: kind === "all" ? undefined : kind, limit: 120 }),
    enabled: Boolean(chatId),
  });

  return (
    <div
      style={{
        borderLeft: "1px solid var(--border-soft)",
        background: "var(--paper-0)",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        width: 340,
      }}
    >
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Media</strong>
        <span className="caseno">{mediaQuery.data?.items.length ?? 0} ITEMS</span>
        <div style={{ flex: 1 }} />
        {onClose && (
          <button className="tb-btn" onClick={onClose}>
            <Icon.x size={14} />
          </button>
        )}
      </div>

      <div className="seg" style={{ margin: "10px 12px 0" }}>
        {(
          [
            ["all", "All"],
            ["image", "Images"],
            ["video", "Video"],
            ["doc", "Docs"],
            ["link", "Links"],
          ] as [Kind | "all", string][]
        ).map(([k, l]) => (
          <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
        {mediaQuery.data?.items.map((m) => {
          const isImage = m.kind === "image";
          const isVideo = m.kind === "video";
          const label = (m.metadata as { name?: string } | null)?.name ?? (m.url ? new URL(m.url).hostname : m.kind);
          const thumb = m.thumbnailUrl ?? null;
          return (
            <div
              key={m.id}
              style={{
                aspectRatio: 1,
                borderRadius: 8,
                border: "1px solid var(--border-soft)",
                background: thumb
                  ? `center/cover no-repeat url(${JSON.stringify(thumb)})`
                  : isImage
                  ? "linear-gradient(135deg, #8B6BF0, #5E3DC7)"
                  : isVideo
                  ? "linear-gradient(135deg, #1E2247, #5E3DC7)"
                  : "var(--paper-50)",
                position: "relative",
                overflow: "hidden",
                cursor: m.url ? "pointer" : "default",
                color: isImage || isVideo ? "#fff" : "var(--fg1)",
              }}
              onClick={() => {
                if (m.url) window.open(m.url, "_blank", "noreferrer");
              }}
            >
              {isVideo && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: "rgba(255,253,248,.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-900)",
                  }}
                >
                  <Icon.play size={16} />
                </div>
              )}
              {!isImage && !isVideo && (
                <div style={{ position: "absolute", top: 10, left: 10 }}>
                  {m.kind === "doc" ? <Icon.file size={20} /> : m.kind === "audio" ? <Icon.mic size={20} /> : <Icon.link size={20} />}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "14px 8px 6px",
                  background: isImage || isVideo ? "linear-gradient(transparent, rgba(14,17,48,.7))" : "transparent",
                  color: isImage || isVideo ? "#fff" : "var(--fg2)",
                  font: "500 10px/1.1 var(--font-mono)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                {m.sizeBytes != null && <span>{formatBytes(m.sizeBytes)}</span>}
              </div>
            </div>
          );
        })}
        {mediaQuery.data?.items.length === 0 && !mediaQuery.isLoading && (
          <div className="empty" style={{ gridColumn: "1 / -1", padding: "40px 10px", minHeight: 0 }}>
            <div className="title" style={{ fontSize: 20 }}>
              Nothing in the evidence locker.
            </div>
            <div className="sub">Files and links posted here will appear in this rail.</div>
          </div>
        )}
      </div>
    </div>
  );
}
