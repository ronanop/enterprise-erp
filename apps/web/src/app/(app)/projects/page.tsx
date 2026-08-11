"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ProjectsDashboard } from "@/components/projects/projects-dashboard";
import { useAuthUser } from "@/hooks/use-auth-user";
import { PROJECTS_MEMBER_HOME } from "@/lib/projects/project-module-nav";

export default function ProjectsPage() {
  const router = useRouter();
  const { loading, projectModuleAdmin } = useAuthUser();

  useEffect(() => {
    if (!loading && !projectModuleAdmin) {
      router.replace(PROJECTS_MEMBER_HOME);
    }
  }, [loading, projectModuleAdmin, router]);

  if (loading || !projectModuleAdmin) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <ProjectsDashboard />;
}
