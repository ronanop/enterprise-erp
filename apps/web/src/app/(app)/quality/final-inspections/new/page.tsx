import { Suspense } from "react";
import { FinalInspectionCreatePage } from "@/components/quality/quality-create-pages";

export default function NewFinalInspectionRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <FinalInspectionCreatePage />
    </Suspense>
  );
}
