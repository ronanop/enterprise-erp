"use client";

import { useEffect } from "react";

import { prefetchProcurementTab } from "@/services/procurement-service";

const PROCUREMENT_TAB_PATHS = [
  "/procurement",
  "/procurement/scm",
  "/procurement/orders",
  "/procurement/grns",
  "/procurement/delivery-challan",
  "/procurement/delivery-status",
  "/procurement/vendors",
  "/procurement/inventory",
] as const;

/** Warm procurement list APIs as soon as the workspace mounts (before tab clicks). */
export function ProcurementRouteWarmup() {
  useEffect(() => {
    for (const href of PROCUREMENT_TAB_PATHS) {
      prefetchProcurementTab(href);
    }
  }, []);
  return null;
}
