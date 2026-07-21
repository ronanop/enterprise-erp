import type { ReactNode } from "react";

import { SalesWorkspaceNav } from "@/components/sales/sales-workspace-nav";

export default function SalesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <SalesWorkspaceNav />
      {children}
    </div>
  );
}
