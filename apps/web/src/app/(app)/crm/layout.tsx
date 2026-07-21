import type { ReactNode } from "react";

import { CrmWorkspaceNav } from "@/components/crm/crm-workspace-nav";

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <CrmWorkspaceNav />
      {children}
    </div>
  );
}
