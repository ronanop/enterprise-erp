import { Suspense } from "react";

import { KpiCreatePage } from "@/components/analytics/analytics-authoring-pages";

export default function NewAnalyticsKpiRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <KpiCreatePage />
    </Suspense>
  );
}
