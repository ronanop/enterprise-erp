"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { ProjectsMemberRouteGuard } from "@/components/projects/projects-member-route-guard";
import { ProjectStageFollowUpInbox } from "@/components/projects/project-stage-follow-up-inbox";
import { ProjectsWorkspaceNav } from "@/components/projects/projects-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

function ProjectsLayoutInner({ children }: { children: ReactNode }) {
  const standalone = useStandaloneChrome();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-5 overflow-x-clip">
      {/* Horizontal strip only when Projects shares the main module sidebar. */}
      {!standalone ? <ProjectsWorkspaceNav /> : null}
      <div className="min-w-0 max-w-full overflow-x-clip">
        <ProjectStageFollowUpInbox />
        <ProjectsMemberRouteGuard>{children}</ProjectsMemberRouteGuard>
      </div>
    </div>
  );
}

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-w-0 max-w-full overflow-x-clip">{children}</div>}>
      <ProjectsLayoutInner>{children}</ProjectsLayoutInner>
    </Suspense>
  );
}
