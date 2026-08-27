"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STANDALONE_KEY = "erp-standalone";

/** CRM always uses its own full-page workspace chrome (no ERP module sidebar). */
export function isCrmStandalonePath(pathname: string) {
  return pathname === "/crm" || pathname.startsWith("/crm/");
}

/** True when this browser tab was opened as a module content tab (no app module sidebar). */
export function useStandaloneChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const crmStandalone = isCrmStandalonePath(pathname);
  const fromQuery = searchParams.get("standalone") === "1";
  const [standalone, setStandalone] = useState(fromQuery || crmStandalone);

  useLayoutEffect(() => {
    if (crmStandalone) {
      setStandalone(true);
      return;
    }
    if (fromQuery) {
      sessionStorage.setItem(STANDALONE_KEY, "1");
      setStandalone(true);
      return;
    }
    setStandalone(sessionStorage.getItem(STANDALONE_KEY) === "1");
  }, [pathname, fromQuery, crmStandalone]);

  return standalone;
}

export { STANDALONE_KEY };
