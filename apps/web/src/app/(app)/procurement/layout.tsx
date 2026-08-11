import type { ReactNode } from "react";

import { ProcurementRouteWarmup } from "@/components/procurement/procurement-route-warmup";
import { ProcurementWorkspaceNav } from "@/components/procurement/procurement-workspace-nav";

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <ProcurementRouteWarmup />
      <ProcurementWorkspaceNav />
      {children}
    </div>
  );
}
