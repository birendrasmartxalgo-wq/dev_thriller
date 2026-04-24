import { create } from "zustand";
import type { AuthUser, WorkspaceSummary } from "@/api/types";

interface SessionState {
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  booted: boolean;
  setUser(user: AuthUser | null): void;
  setWorkspaces(list: WorkspaceSummary[]): void;
  setActiveWorkspace(id: string | null): void;
  setBooted(v: boolean): void;
  reset(): void;
}

const STORAGE_KEY = "dt.activeWorkspace";

export const useSession = create<SessionState>((set) => ({
  user: null,
  workspaces: [],
  activeWorkspaceId: typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  booted: false,
  setUser: (user) => set({ user }),
  setWorkspaces: (workspaces) =>
    set((s) => {
      const hasActive = workspaces.some((w) => w.id === s.activeWorkspaceId);
      const nextActive = hasActive ? s.activeWorkspaceId : workspaces[0]?.id ?? null;
      if (nextActive && typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, nextActive);
      return { workspaces, activeWorkspaceId: nextActive };
    }),
  setActiveWorkspace: (id) => {
    if (id && typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    set({ activeWorkspaceId: id });
  },
  setBooted: (v) => set({ booted: v }),
  reset: () => set({ user: null, workspaces: [], activeWorkspaceId: null }),
}));
