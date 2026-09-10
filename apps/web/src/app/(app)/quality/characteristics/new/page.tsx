import { Suspense } from "react";

import { CharacteristicCreatePage } from "@/components/quality/quality-master-pages";

export default function QualityCharacteristicCreateRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <CharacteristicCreatePage />
    </Suspense>
  );
}
