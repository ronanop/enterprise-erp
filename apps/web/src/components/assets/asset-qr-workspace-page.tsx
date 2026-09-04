"use client";

import { Suspense } from "react";

import { AssetQrWorkspace } from "@/components/assets/asset-qr-workspace";

export function AssetQrWorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AssetQrWorkspace />
    </Suspense>
  );
}
