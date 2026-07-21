import type { ReactNode } from "react";

import { HrWorkspaceNav } from "@/components/hr/hr-workspace-nav";

export default function HrLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <HrWorkspaceNav />
      {children}
    </div>
  );
}
