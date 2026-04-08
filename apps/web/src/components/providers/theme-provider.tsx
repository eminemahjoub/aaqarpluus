"use client";

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "aaqar-theme";

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const next = saved === "dark" ? "dark" : "light";
      setThemeState(next);
      applyThemeToDocument(next);
    } catch {
      applyThemeToDocument("light");
    }
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Ensure SSR/CSR match: don't flip theme until mounted.
  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme: mounted ? theme : "light",
      resolvedTheme: mounted ? theme : "light",
      setTheme,
    }),
    [mounted, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light" as const,
      resolvedTheme: "light" as const,
      setTheme: (_t: Theme) => {},
    };
  }
  return ctx;
}
