import type { ReactNode } from "react";

import { ServiceFieldEngineerLayoutGuard } from "@/components/service/service-field-engineer-layout-guard";
import { ServiceWorkspaceNav } from "@/components/service/service-workspace-nav";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <ServiceFieldEngineerLayoutGuard>
      <div className="space-y-4">
        <ServiceWorkspaceNav />
        {children}
      </div>
    </ServiceFieldEngineerLayoutGuard>
  );
}
