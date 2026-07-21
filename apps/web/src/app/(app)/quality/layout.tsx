import type { ReactNode } from "react";

import { QualityWorkspaceNav } from "@/components/quality/quality-workspace-nav";

export default function QualityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <QualityWorkspaceNav />
      {children}
    </div>
  );
}
