import { create } from "zustand";

export interface ToastItem {
  id: number;
  kind: "info" | "error";
  text: string;
}

interface ToastState {
  items: ToastItem[];
  push(kind: ToastItem["kind"], text: string): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push(kind, text) {
    const id = ++seq;
    set((s) => ({ items: [...s.items, { id, kind, text }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss(id) {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));

export function toast(text: string, kind: ToastItem["kind"] = "info") {
  useToasts.getState().push(kind, text);
}
