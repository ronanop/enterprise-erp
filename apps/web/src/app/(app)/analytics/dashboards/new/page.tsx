import { Suspense } from "react";

import { DashboardCreatePage } from "@/components/analytics/analytics-authoring-pages";

export default function NewAnalyticsDashboardRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading form…</p>}>
      <DashboardCreatePage />
    </Suspense>
  );
}
