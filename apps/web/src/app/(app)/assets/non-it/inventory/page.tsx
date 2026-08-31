import { Suspense } from "react";

import { NonItAssetsWorkspace } from "@/components/assets/non-it/non-it-assets-workspace";

export default function NonItInventoryPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}>
      <NonItAssetsWorkspace />
    </Suspense>
  );
}
