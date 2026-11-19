"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthUser } from "@/hooks/use-auth-user";
import {
  isProjectsAdminOnlyPath,
  PROJECTS_MEMBER_HOME,
} from "@/lib/projects/project-module-nav";

/** Redirect module members away from admin-only Projects routes. */
export function ProjectsMemberRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, projectModuleAdmin } = useAuthUser();

  useEffect(() => {
    if (loading || projectModuleAdmin) return;
    if (isProjectsAdminOnlyPath(pathname)) {
      router.replace(PROJECTS_MEMBER_HOME);
    }
  }, [loading, pathname, projectModuleAdmin, router]);

  if (!loading && !projectModuleAdmin && isProjectsAdminOnlyPath(pathname)) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return <>{children}</>;
}
