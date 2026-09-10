import { Suspense } from "react";
import { InprocessInspectionCreatePage } from "@/components/quality/quality-create-pages";

export default function NewInprocessInspectionRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <InprocessInspectionCreatePage />
    </Suspense>
  );
}
