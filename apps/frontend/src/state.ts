import { create } from "zustand";
import type { Snapshot } from "@metro/shared-types";
export type ViewMode = "map" | "lines";
export type Theme = "light" | "dark";
export function saved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private/restricted storage. */
  }
}
export const adaptiveView = (): ViewMode =>
  matchMedia("(min-width: 1200px) and (pointer: fine)").matches
    ? "map"
    : "lines";
type Store = {
  snapshot: Snapshot | null;
  setSnapshot: (snapshot: Snapshot | null) => void;
  now: number;
  connected: boolean;
  loading: boolean;
  error: string | null;
  paused: boolean;
  reducedMotion: boolean;
  view: ViewMode;
  theme: Theme;
  setView: (view: ViewMode) => void;
  toggleTheme: () => void;
  togglePaused: () => void;
};
const storedTheme = saved("metro-theme");
export const useSnapshotStore = create<Store>((set, get) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  now: Date.now() / 1000,
  connected: false,
  loading: true,
  error: null,
  paused: false,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  view:
    saved("metro-view") === "map"
      ? "map"
      : saved("metro-view") === "lines"
        ? "lines"
        : adaptiveView(),
  theme:
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
  setView: (view) => {
    persist("metro-view", view);
    set({ view });
  },
  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    persist("metro-theme", theme);
    set({ theme });
  },
  togglePaused: () => set({ paused: !get().paused }),
}));
