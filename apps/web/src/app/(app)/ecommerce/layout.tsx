import type { ReactNode } from "react";

import { EcommerceWorkspaceNav } from "@/components/ecommerce/ecommerce-workspace-nav";

export default function EcommerceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <EcommerceWorkspaceNav />
      {children}
    </div>
  );
}
