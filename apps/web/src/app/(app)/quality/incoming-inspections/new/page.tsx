import { Suspense } from "react";
import { IncomingInspectionCreatePage } from "@/components/quality/incoming-inspection-create-page";

export default function NewIncomingInspectionRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <IncomingInspectionCreatePage />
    </Suspense>
  );
}
