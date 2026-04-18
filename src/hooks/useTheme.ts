import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "taste-theme";

function readInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  const applyTheme = useCallback((next: Theme) => {
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Sync with system preference when the user hasn't set a manual preference
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* noop */ }
    if (stored) return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handle = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "light" : "dark";
      setThemeState(next);
      applyTheme(next);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [applyTheme]);

  return { theme, setTheme, toggleTheme };
}
