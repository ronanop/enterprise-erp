import type { ReactNode } from "react";

import { FinanceWorkspaceNav } from "@/components/finance/finance-workspace-nav";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <FinanceWorkspaceNav />
      {children}
    </div>
  );
}
