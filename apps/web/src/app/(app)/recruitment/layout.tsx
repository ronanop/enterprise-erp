import type { ReactNode } from "react";

import { RecruitmentWorkspaceNav } from "@/components/recruitment/recruitment-workspace-nav";

export default function RecruitmentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <RecruitmentWorkspaceNav />
      {children}
    </div>
  );
}
