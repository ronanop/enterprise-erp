"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STANDALONE_KEY = "erp-standalone";

/** True when this browser tab was opened as a module content tab (no app module sidebar). */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("standalone") === "1";
  const [standalone, setStandalone] = useState(fromQuery);

  useLayoutEffect(() => {
    if (fromQuery) {
      sessionStorage.setItem(STANDALONE_KEY, "1");
      setStandalone(true);
      return;
    }
    setStandalone(sessionStorage.getItem(STANDALONE_KEY) === "1");
  }, [pathname, fromQuery]);

  return standalone;
}

export { STANDALONE_KEY };
