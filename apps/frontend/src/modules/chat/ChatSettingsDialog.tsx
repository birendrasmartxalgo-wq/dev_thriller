// Settings dialog for a chat: rename, topic, archive, delete.
// Owner/admin/creator-only edit + destructive actions — the backend enforces,
// but we soft-hide the delete button for plain members.

import { useEffect, useState } from "react";
import { chatApi } from "@/api/endpoints";
import type { ChatDetail } from "@/api/types";
import { toast } from "@/store/toast";
import { Icon } from "@/components/Icons";

interface Props {
  chat: ChatDetail;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

export function ChatSettingsDialog({ chat, canManage, onClose, onChanged, onDeleted }: Props) {
  const [name, setName] = useState(chat.name);
  const [topic, setTopic] = useState(chat.topic ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await chatApi.update(chat.id, {
        name: name.trim() || undefined,
        topic: topic.trim() === "" ? null : topic.trim(),
      });
      toast("Chat updated");
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    if (busy) return;
    setBusy(true);
    try {
      if (chat.archivedAt) {
        await chatApi.update(chat.id, { archivedAt: null });
        toast("Chat unarchived");
      } else {
        await chatApi.update(chat.id, { archivedAt: true });
        toast("Chat archived");
      }
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (busy) return;
    if (!confirm(`Delete "${chat.name}"? Members will lose access immediately.`)) return;
    setBusy(true);
    try {
      await chatApi.remove(chat.id);
      toast("Chat deleted");
      onDeleted();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14, 17, 48, 0.35)",
        zIndex: 120,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--paper-0)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "var(--sh-3)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon.settings size={16} />
          <strong style={{ font: "600 14px/1 var(--font-sans)" }}>Chat settings</strong>
          <span className="caseno">CASE · {chat.type.toUpperCase()}</span>
          <div style={{ flex: 1 }} />
          <button className="tb-btn" onClick={onClose}>
            <Icon.x size={14} />
          </button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">NAME</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              maxLength={80}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="caseno">TOPIC</span>
            <textarea
              className="input"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!canManage}
              maxLength={250}
              style={{ resize: "vertical", font: "400 13px/1.5 var(--font-sans)" }}
              placeholder="What is this chat about?"
            />
          </label>
          {chat.archivedAt && (
            <div className="chip" style={{ background: "var(--warning-bg)", color: "var(--fg1)" }}>
              <span className="dot" /> ARCHIVED · {new Date(chat.archivedAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-soft)",
            background: "var(--bg-sunken)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {canManage && (
            <>
              <button className="btn btn-secondary" onClick={toggleArchive} disabled={busy}>
                {chat.archivedAt ? "Unarchive" : "Archive"}
              </button>
              <button
                className="btn"
                onClick={doDelete}
                disabled={busy}
                style={{ background: "var(--blood-500)", color: "#fff", border: 0 }}
              >
                <Icon.trash size={14} /> Delete
              </button>
            </>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              <Icon.check size={14} /> Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
