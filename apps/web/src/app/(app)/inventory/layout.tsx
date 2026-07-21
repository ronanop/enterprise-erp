import type { ReactNode } from "react";

import { InventoryWorkspaceNav } from "@/components/inventory/inventory-workspace-nav";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <InventoryWorkspaceNav />
      {children}
    </div>
  );
}
