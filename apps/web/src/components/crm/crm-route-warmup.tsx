"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CRM_NAV } from "@/components/crm/crm-workspace-nav";
import { prefetchCrmTab } from "@/services/sales-crm-service";

function warmAllCrmTabs(router: ReturnType<typeof useRouter>): void {
  for (const item of CRM_NAV) {
    router.prefetch(item.href);
    prefetchCrmTab(item.href);
  }
}

/** Prefetch CRM routes and list APIs while the workspace is open. */
export function CrmRouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => warmAllCrmTabs(router), { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => warmAllCrmTabs(router), 150);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const active =
      CRM_NAV.find((item) =>
        item.href === "/crm"
          ? pathname === "/crm"
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? CRM_NAV[0];
    router.prefetch(active.href);
    prefetchCrmTab(active.href);
  }, [pathname, router]);

  return null;
}
