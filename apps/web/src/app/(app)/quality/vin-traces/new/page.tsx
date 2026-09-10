import { Suspense } from "react";
import { VinTraceCreatePage } from "@/components/quality/quality-create-pages";

export default function NewVinTraceRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <VinTraceCreatePage />
    </Suspense>
  );
}
