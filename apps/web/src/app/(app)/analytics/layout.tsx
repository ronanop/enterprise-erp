import type { ReactNode } from "react";

import { AnalyticsWorkspaceNav } from "@/components/analytics/analytics-workspace-nav";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AnalyticsWorkspaceNav />
      {children}
    </div>
  );
}
