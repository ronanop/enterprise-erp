"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { FolderKanban } from "lucide-react";

import { ModuleSidebar } from "@/components/layout/module-sidebar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { filterProjectsNavGroups } from "@/lib/projects/project-module-nav";

export type ProjectsNavItem = {
  title: string;
  href: string;
  /** Optional workflow stage key for stage list pages. */
  stage?: string;
  /** Nested links shown as a sidebar dropdown under this item. */
  children?: readonly ProjectsNavItem[];
};

export type ProjectsNavGroup = {
  label: string;
  items: readonly ProjectsNavItem[];
};

/**
 * Projects module sidebar - primary workspace links for delivery admins and members.
 */
export const PROJECTS_NAV_GROUPS: readonly ProjectsNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/projects" },
      {
        title: "My Jobs",
        href: "/projects/my-jobs",
        children: [
          { title: "Completed Jobs", href: "/projects/completed-jobs" },
        ],
      },
      { title: "PO Queue", href: "/projects/po-queue" },
      { title: "Projects", href: "/projects/projects" },
      { title: "Tracker", href: "/projects/tracker" },
      { title: "All Sites", href: "/projects/site-installations" },
    ],
  },
] as const;

/** Flat list for search / legacy callers (includes nested children). */
export const PROJECTS_NAV: readonly ProjectsNavItem[] = PROJECTS_NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((item) => [item, ...(item.children ?? [])]),
);

function isProjectsNavActive(pathname: string, href: string): boolean {
  if (href === "/projects") return pathname === "/projects";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left sidebar for the Projects workspace. */
export function ProjectsSidebar() {
  const pathname = usePathname();
  const { projectModuleAdmin } = useAuthUser();

  const groups = useMemo(
    () => filterProjectsNavGroups(PROJECTS_NAV_GROUPS, projectModuleAdmin),
    [projectModuleAdmin],
  );
  return (
    <ModuleSidebar
      moduleKey="projects"
      title="Project Delivery"
      icon={FolderKanban}
      aria-label="Projects workspace"
      groups={groups}
      isActive={(item) => isProjectsNavActive(pathname, item.href)}
    />
  );
}
