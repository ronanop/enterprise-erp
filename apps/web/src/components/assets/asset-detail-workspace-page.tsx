"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AssetDetailWorkspace } from "@/components/assets/asset-detail-workspace";

export function AssetDetailWorkspacePage({ assetId }: { assetId: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <AssetDetailWorkspace assetId={assetId} />
    </Suspense>
  );
}
