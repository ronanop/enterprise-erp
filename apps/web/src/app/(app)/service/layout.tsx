import type { ReactNode } from "react";

import { ServiceWorkspaceNav } from "@/components/service/service-workspace-nav";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <ServiceWorkspaceNav />
      {children}
    </div>
  );
}
