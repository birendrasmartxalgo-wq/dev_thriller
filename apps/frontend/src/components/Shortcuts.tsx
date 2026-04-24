// Migrated from app/extras.jsx — keyboard-shortcut cheat sheet modal.

import { useEffect } from "react";
import { Icon } from "@/components/Icons";
import { useFocusTrap } from "@/lib/focusTrap";

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: "Navigation",
    items: [
      [["⌘", "K"], "Global search"],
      [["G", "H"], "Go to dashboard"],
      [["G", "F"], "Go to files"],
      [["G", "I"], "Go to inbox"],
    ],
  },
  {
    title: "Chat",
    items: [
      [["↑"], "Edit last message"],
      [["⌘", "↵"], "Send message"],
      [["⇧", "↵"], "New line"],
      [["T"], "Open thread panel"],
    ],
  },
  {
    title: "Files",
    items: [
      [["U"], "Upload file"],
      [["⌘", "D"], "Download selected"],
      [["⌘", "⇧", "C"], "Copy share link"],
    ],
  },
  {
    title: "Workspace",
    items: [
      [["⌘", ","], "Settings"],
      [["?"], "This cheat sheet"],
      [["esc"], "Close modals"],
    ],
  },
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={trapRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 720 }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="caseno">CASE · COMMAND REFERENCE</div>
          <div style={{ flex: 1 }} />
          <kbd>esc</kbd>
          <button type="button" className="tb-btn" aria-label="Close" onClick={onClose}>
            <Icon.x size={14} aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: "10px 22px 22px" }}>
          <h2 style={{ font: "400 28px/1.1 var(--font-display)", margin: "10px 0 18px" }}>
            Keyboard <span style={{ fontStyle: "italic" }}>shortcuts</span>.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div className="caseno" style={{ marginBottom: 8, color: "var(--ember-700)" }}>
                  {g.title.toUpperCase()}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {g.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px dashed var(--border-soft)" }}>
                      <span style={{ font: "400 13px/1.4 var(--font-sans)", flex: 1 }}>{it[1]}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {it[0].map((k, j) => (
                          <kbd key={j}>{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
