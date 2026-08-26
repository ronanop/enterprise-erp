"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STANDALONE_KEY = "erp-standalone";

/** True when this browser tab was opened as a module content tab (no app module sidebar). */
export function useStandaloneChrome() {
  const pathname = usePathname();
  // Avoid useSearchParams() here — it forces CSR bailout across the whole app shell
  // and contributes to soft-navigation RSC failures ("This page couldn't load").
  const [standalone, setStandalone] = useState(false);
  const isFirstEffect = useRef(true);

  useLayoutEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("standalone") === "1";

    if (fromQuery) {
      sessionStorage.setItem(STANDALONE_KEY, "1");
      setStandalone(true);
      isFirstEffect.current = false;
      return;
    }

    if (isFirstEffect.current) {
      // Fresh document load without ?standalone=1 → always show full chrome.
      sessionStorage.removeItem(STANDALONE_KEY);
      setStandalone(false);
      isFirstEffect.current = false;
      return;
    }

    // Client-side navigations inside an already-standalone tab keep the mode.
    setStandalone(sessionStorage.getItem(STANDALONE_KEY) === "1");
  }, [pathname]);

  return standalone;
}

export { STANDALONE_KEY };
