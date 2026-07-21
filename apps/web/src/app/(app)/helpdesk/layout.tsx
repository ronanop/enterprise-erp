import type { ReactNode } from "react";

import { HelpdeskWorkspaceNav } from "@/components/helpdesk/helpdesk-workspace-nav";

export default function HelpdeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <HelpdeskWorkspaceNav />
      {children}
    </div>
  );
}
