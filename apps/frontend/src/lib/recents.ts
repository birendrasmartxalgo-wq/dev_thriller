// Lightweight LRU of "things the user just opened" — chats, files, search queries.
// Persisted in localStorage under `dt.recents`. Capped at MAX entries.

import type { Icon } from "@/components/Icons";

const KEY = "dt.recents";
const MAX = 10;

export interface RecentEntry {
  id: string;
  kind: "chat" | "file" | "search" | "other";
  label: string;
  sub?: string;
  icon?: keyof typeof Icon;
  /** Optional href to navigate to on commit; otherwise consumer infers from kind+id. */
  runHref?: string;
  ts: number;
}

export function getRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.id === "string" && typeof e.label === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<RecentEntry, "ts">): void {
  try {
    const cur = getRecents();
    const next: RecentEntry[] = [{ ...entry, ts: Date.now() }, ...cur.filter((e) => e.id !== entry.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* localStorage may be disabled — silently no-op */
  }
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
