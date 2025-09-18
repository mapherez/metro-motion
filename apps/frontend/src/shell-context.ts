import { createContext, useContext } from "react";
import type { Snapshot } from "@metro/shared-types";

export type ThemeMode = "dark" | "light";

export type ShellContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  snapshot: Snapshot | null;
  serviceOpen: boolean | null;
  sinceText: string;
  loading: boolean;
  error: string | null;
};

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShellContext(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("ShellContext is missing. Wrap components with ShellContext.Provider.");
  }
  return ctx;
}
