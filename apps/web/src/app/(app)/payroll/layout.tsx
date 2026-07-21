import type { ReactNode } from "react";

import { PayrollWorkspaceNav } from "@/components/payroll/payroll-workspace-nav";

export default function PayrollLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <PayrollWorkspaceNav />
      {children}
    </div>
  );
}
