import type { ReactNode } from "react";

import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <PortalWorkspaceNav />
      {children}
    </div>
  );
}
