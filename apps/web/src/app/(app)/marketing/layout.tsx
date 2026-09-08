import type { ReactNode } from "react";

import { MarketingWorkspaceNav } from "@/components/marketing/marketing-workspace-nav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-clip md:flex-row md:gap-5">
      <MarketingWorkspaceNav />
      <div className="min-w-0 flex-1 overflow-x-clip">{children}</div>
    </div>
  );
}
