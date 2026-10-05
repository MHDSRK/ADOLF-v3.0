"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  isMode,
  type Mode,
} from "@/lib/themes";

interface ThemeContextValue {
  mode: Mode;
  setMode: (next: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialMode(): Mode {
  if (typeof window === "undefined") return DEFAULT_MODE;

  const fromAttr = document.documentElement.dataset.mode;
  if (isMode(fromAttr)) return fromAttr;

  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }

  return DEFAULT_MODE;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readInitialMode);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.mode = next;
    }

    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // The in-memory state still updates for the current tab.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== MODE_STORAGE_KEY) return;

      if (isMode(e.newValue) && e.newValue !== mode) {
        setModeState(e.newValue);
        document.documentElement.dataset.mode = e.newValue;
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    return {
      mode: DEFAULT_MODE,
      setMode: () => {},
      toggleMode: () => {},
    };
  }

  return ctx;
}
