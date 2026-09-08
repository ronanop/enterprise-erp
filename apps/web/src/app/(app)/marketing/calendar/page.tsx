import { Suspense } from "react";

import { MarketingCalendarPage } from "@/components/marketing/marketing-calendar-page";

export default function MarketingCalendarRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading calendar</p>}>
      <MarketingCalendarPage />
    </Suspense>
  );
}
