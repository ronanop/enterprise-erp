import { Suspense } from "react";

import { PfmeaCreatePage } from "@/components/quality/quality-master-pages";

export default function QualityPfmeaCreateRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <PfmeaCreatePage />
    </Suspense>
  );
}
