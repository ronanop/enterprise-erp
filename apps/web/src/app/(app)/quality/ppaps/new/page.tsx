import { Suspense } from "react";

import { PpapCreatePage } from "@/components/quality/quality-create-pages";

export default function NewPpapRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <PpapCreatePage />
    </Suspense>
  );
}
