import { Suspense } from "react";

import { DefectCreatePage } from "@/components/quality/quality-create-pages";

export default function NewDefectRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <DefectCreatePage />
    </Suspense>
  );
}
