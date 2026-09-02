"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useClientAuth } from "@/hooks/use-client-auth";
import {
  loadProcurementOverview,
  peekProcurementOverviewFromCache,
} from "@/services/procurement-service";
import { getUnseenScmOvfIds } from "@/utils/scm-queue-seen";

function unreadScmFromOverview(): number {
  const overview = peekProcurementOverviewFromCache();
  const ids = (overview?.scmQueue ?? [])
    .map((row) => String(row.ovf_id ?? ""))
    .filter(Boolean);
  return getUnseenScmOvfIds(ids).length;
}

/** Unseen SCM queue OVFs — same source as the topbar bell badge. */
export function useScmQueueUnreadCount(): number {
  const signedIn = useClientAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    setCount(unreadScmFromOverview());
  }, []);

  useEffect(() => {
    refresh();
    if (!signedIn) return;

    let cancelled = false;
    void loadProcurementOverview()
      .then(() => {
        if (!cancelled) refresh();
      })
      .catch(() => undefined);

    const id = window.setInterval(() => {
      void loadProcurementOverview()
        .then(() => {
          if (!cancelled) refresh();
        })
        .catch(() => undefined);
    }, 45_000);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    window.addEventListener("erp:scm-queue-seen", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
      window.removeEventListener("erp:scm-queue-seen", onFocus);
    };
  }, [signedIn, refresh, pathname]);

  return count;
}
