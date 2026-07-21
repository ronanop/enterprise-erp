import type { ReactNode } from "react";

import { IntegrationWorkspaceNav } from "@/components/integration/integration-workspace-nav";

export default function IntegrationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <IntegrationWorkspaceNav />
      {children}
    </div>
  );
}
