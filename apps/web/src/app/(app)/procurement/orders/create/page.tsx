import { Suspense } from "react";

import { ProcurementManualCreatePoPage } from "@/components/procurement/procurement-manual-create-po-page";

export default function ProcurementOrdersCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ProcurementManualCreatePoPage />
    </Suspense>
  );
}
