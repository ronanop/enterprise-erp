"use client";

import { Suspense } from "react";

import { AssetAssignmentWorkspace } from "@/components/assets/asset-assignment-workspace";

export function AssetAssignmentWorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssetAssignmentWorkspace />
    </Suspense>
  );
}
