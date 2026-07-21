import type { ReactNode } from "react";

import { ManufacturingWorkspaceNav } from "@/components/manufacturing/manufacturing-workspace-nav";

export default function ManufacturingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <ManufacturingWorkspaceNav />
      {children}
    </div>
  );
}
