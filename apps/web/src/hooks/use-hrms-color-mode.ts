"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hrms-color-mode";
const EVENT_KEY = "hrms-color-mode";

export type HrmsColorMode = "light" | "dark";

function readMode(): HrmsColorMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function useHrmsColorMode() {
  const [mode, setMode] = useState<HrmsColorMode>("light");

  useEffect(() => {
    setMode(readMode());
    const sync = () => setMode(readMode());
    window.addEventListener(EVENT_KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: HrmsColorMode = readMode() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setMode(next);
    window.dispatchEvent(new Event(EVENT_KEY));
  }, []);

  return { mode, dark: mode === "dark", toggle };
}
