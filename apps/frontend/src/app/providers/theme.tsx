import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  applyTheme,
  buildThemeTokens,
  loadSettings,
  loadThemeConfig,
  type ThemeTokens
} from "@metro/shared-utils";

const THEME_STORAGE_KEY = "metro-theme";
const APP_ID = "frontend";

type ThemeName = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeName;
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(defaultTheme: ThemeName): ThemeName {
  if (typeof window === "undefined") {
    return defaultTheme;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : defaultTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useMemo(() => loadSettings(APP_ID), []);
  const themeConfig = useMemo(() => loadThemeConfig(APP_ID), []);
  const defaultTheme = (themeConfig.theme ?? settings.theme ?? "light") === "dark" ? "dark" : "light";
  const initialTheme = resolveInitialTheme(defaultTheme);

  const [theme, setThemeState] = useState<ThemeName>(initialTheme);
  const [tokens, setTokens] = useState<ThemeTokens>(() => buildThemeTokens(initialTheme, themeConfig.overrides));

  useEffect(() => {
    setTokens(applyTheme(theme, undefined, themeConfig.overrides));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme, themeConfig.overrides]);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeState(name);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, tokens, setTheme, toggleTheme }),
    [theme, tokens, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("ThemeProvider is missing in the component tree.");
  }
  return ctx;
}

export type { ThemeName };
