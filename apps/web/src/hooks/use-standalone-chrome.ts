"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STANDALONE_KEY = "erp-standalone";

/** True when this browser tab was opened as a module content tab (no app module sidebar). */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("standalone") === "1";
  // Match SSR: only the query param is known on the server.
  const [standalone, setStandalone] = useState(fromQuery);
  const isFirstEffect = useRef(true);

  useLayoutEffect(() => {
    if (fromQuery) {
      sessionStorage.setItem(STANDALONE_KEY, "1");
      setStandalone(true);
      isFirstEffect.current = false;
      return;
    }

    if (isFirstEffect.current) {
      // Fresh document load without ?standalone=1 → always show full chrome.
      // Stops a sticky session flag from hiding the sidebar after refresh.
      sessionStorage.removeItem(STANDALONE_KEY);
      setStandalone(false);
      isFirstEffect.current = false;
      return;
    }

    // Client-side navigations inside an already-standalone tab keep the mode.
    setStandalone(sessionStorage.getItem(STANDALONE_KEY) === "1");
  }, [pathname, fromQuery]);

  return standalone;
}

export { STANDALONE_KEY };
