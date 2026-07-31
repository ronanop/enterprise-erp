"use client";

import { Suspense } from "react";

import { AssetMaintenanceWorkspace } from "@/components/assets/asset-maintenance-workspace";

export function AssetMaintenanceWorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssetMaintenanceWorkspace />
    </Suspense>
  );
}
