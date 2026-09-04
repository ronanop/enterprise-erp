import type { ReactNode } from "react";

import { MarketingWorkspaceNav } from "@/components/marketing/marketing-workspace-nav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <MarketingWorkspaceNav />
      {children}
    </div>
  );
}
