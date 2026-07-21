import type { ReactNode } from "react";

import { AssetsWorkspaceNav } from "@/components/assets/assets-workspace-nav";

export default function AssetsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AssetsWorkspaceNav />
      {children}
    </div>
  );
}
