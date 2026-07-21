import type { ReactNode } from "react";

import { GrcWorkspaceNav } from "@/components/grc/grc-workspace-nav";

export default function GrcLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <GrcWorkspaceNav />
      {children}
    </div>
  );
}
