import type { ReactNode } from "react";

import { ProcurementWorkspaceNav } from "@/components/procurement/procurement-workspace-nav";

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <ProcurementWorkspaceNav />
      {children}
    </div>
  );
}
