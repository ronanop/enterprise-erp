"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ALL_PROCUREMENT_NAV,
  PROCUREMENT_NAV,
  warmAllProcurementNavTargets,
  warmProcurementNavTarget,
} from "@/components/procurement/procurement-workspace-nav";

/** Prefetch procurement routes and list APIs while the workspace is open. */
export function ProcurementRouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  const onOvfFlow = pathname.includes("/procurement/scm/ovf/");

  useEffect(() => {
    if (onOvfFlow) return;
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => warmAllProcurementNavTargets(router), { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => warmAllProcurementNavTargets(router), 150);
    return () => window.clearTimeout(timer);
  }, [router, onOvfFlow]);

  useEffect(() => {
    if (onOvfFlow) return;
    const active =
      ALL_PROCUREMENT_NAV.find((item) =>
        item.href === "/procurement"
          ? pathname === "/procurement"
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? PROCUREMENT_NAV[0];
    warmProcurementNavTarget(router, active.href);
  }, [pathname, router, onOvfFlow]);

  return null;
}
