import { Suspense } from "react";

import { ExecutiveKpiDetailPage } from "@/components/analytics/executive/ExecutiveKpiDetailPage";

export default function AnalyticsExecutiveKpiDetailRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ExecutiveKpiDetailPage />
    </Suspense>
  );
}
