import type { ReactNode } from "react";

import { DocumentsWorkspaceNav } from "@/components/documents/documents-workspace-nav";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <DocumentsWorkspaceNav />
      {children}
    </div>
  );
}
