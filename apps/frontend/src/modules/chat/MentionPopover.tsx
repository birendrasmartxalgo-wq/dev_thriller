// Mention autocomplete popover.
// Listens to a textarea's value + caret, looks for `@prefix` at the caret position,
// fetches matching workspace members (debounced), and offers keyboard navigation.

import { useEffect, useMemo, useRef, useState } from "react";
import { workspaceApi } from "@/api/endpoints";
import type { WorkspaceMember } from "@/api/types";

export interface MentionState {
  open: boolean;
  prefix: string;
  start: number; // index in body where `@` lives
  end: number;   // caret position
}

export function getMentionContext(body: string, caret: number): MentionState {
  // Walk back from caret until we hit whitespace or `@`.
  let i = caret - 1;
  while (i >= 0) {
    const ch = body[i]!;
    if (ch === "@") {
      // Valid iff preceded by start/space.
      const prev = i > 0 ? body[i - 1]! : "";
      if (i === 0 || /\s/.test(prev)) {
        const prefix = body.slice(i + 1, caret);
        // Abort if prefix contains whitespace (we only match one word for now).
        if (/\s/.test(prefix)) return { open: false, prefix: "", start: i, end: caret };
        return { open: true, prefix, start: i, end: caret };
      }
      break;
    }
    if (/\s/.test(ch)) break;
    i--;
  }
  return { open: false, prefix: "", start: -1, end: caret };
}

export function applyMention(body: string, state: MentionState, member: WorkspaceMember): { body: string; caret: number } {
  const name = member.name ?? member.email ?? "member";
  const insert = `@${name} `;
  const next = body.slice(0, state.start) + insert + body.slice(state.end);
  return { body: next, caret: state.start + insert.length };
}

interface Props {
  workspaceId: string;
  state: MentionState;
  anchorRect: DOMRect | null;
  onPick: (m: WorkspaceMember) => void;
  onDismiss: () => void;
}

export function MentionPopover({ workspaceId, state, anchorRect, onPick, onDismiss }: Props) {
  const [items, setItems] = useState<WorkspaceMember[]>([]);
  const [active, setActive] = useState(0);
  const debounceRef = useRef<number | null>(null);

  // Debounce the search query to the backend (q= prefix).
  useEffect(() => {
    if (!state.open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await workspaceApi.members(workspaceId, { q: state.prefix, limit: 8 });
        setItems(r.items);
        setActive(0);
      } catch {
        setItems([]);
      }
    }, 120) as unknown as number;
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state.open, state.prefix, workspaceId]);

  // Keyboard nav is driven by the parent (composer). Expose imperative helpers via a window event.
  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (items[active]) {
          e.preventDefault();
          onPick(items[active]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [state.open, items, active, onPick, onDismiss]);

  const style = useMemo<React.CSSProperties>(() => {
    if (!anchorRect) return { display: "none" };
    return {
      position: "fixed",
      left: Math.min(anchorRect.left + 8, window.innerWidth - 260),
      bottom: window.innerHeight - anchorRect.top + 6,
      zIndex: 80,
      width: 240,
      background: "var(--paper-0)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      boxShadow: "var(--sh-2)",
      padding: 4,
      maxHeight: 240,
      overflowY: "auto",
    };
  }, [anchorRect]);

  if (!state.open || items.length === 0) return null;

  return (
    <div style={style} onMouseDown={(e) => e.preventDefault()}>
      <div style={{ font: "500 11px/1 var(--font-mono)", color: "var(--fg3)", padding: "4px 8px", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        MENTION · {items.length}
      </div>
      {items.map((m, i) => {
        const name = m.name ?? m.email ?? m.userId.slice(-6);
        const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
        return (
          <button
            key={m.userId}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(m);
            }}
            onMouseEnter={() => setActive(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: 0,
              background: i === active ? "var(--ember-50)" : "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div className="av" style={{ width: 22, height: 22, fontSize: 10, background: "var(--lav-500)" }}>
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span style={{ font: "500 13px/1.1 var(--font-sans)", color: "var(--fg1)" }}>{name}</span>
              {m.email && (
                <span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg3)" }}>{m.email}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
