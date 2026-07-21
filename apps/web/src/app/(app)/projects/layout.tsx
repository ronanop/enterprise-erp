import type { ReactNode } from "react";

import { ProjectsWorkspaceNav } from "@/components/projects/projects-workspace-nav";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <ProjectsWorkspaceNav />
      {children}
    </div>
  );
}
