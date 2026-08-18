import type { ProjectsNavGroup } from "@/components/projects/projects-workspace-nav";

/** Delivery queues and portfolio admin surfaces — module admin only. */
const ADMIN_ONLY_HREFS = new Set([
  "/projects/po-queue",
  "/projects/tracker",
  "/projects/site-installations",
  "/projects/intake",
  "/projects/assignment",
  "/projects/survey",
  "/projects/scm",
  "/projects/onsite_delivery",
  "/projects/material_handover",
  "/projects/installation",
  "/projects/acceptance",
  "/projects/completed",
  "/projects/users",
]);

const PROJECTS_USERS_ITEM = { title: "Users", href: "/projects/users" } as const;

/** Workspace links available to every Projects user. */
const MEMBER_WORKSPACE_HREFS = [
  "/projects",
  "/projects/my-jobs",
  "/projects/completed-jobs",
  "/projects/projects",
] as const;

export function filterProjectsNavGroups(
  groups: readonly ProjectsNavGroup[],
  isProjectModuleAdmin: boolean,
): ProjectsNavGroup[] {
  if (isProjectModuleAdmin) {
    return groups.map((g, index) => ({
      ...g,
      items: index === 0 ? [...g.items, PROJECTS_USERS_ITEM] : [...g.items],
    }));
  }

  return [
    {
      label: "Workspace",
      items: MEMBER_WORKSPACE_HREFS.map((href) => {
        const found = groups.flatMap((g) => g.items).find((i) => i.href === href);
        return (
          found ?? {
            title:
              href === "/projects"
                ? "Dashboard"
                : href === "/projects/my-jobs"
                  ? "My Jobs"
                  : href === "/projects/completed-jobs"
                    ? "Completed Jobs"
                    : "Projects",
            href,
          }
        );
      }),
    },
  ];
}

export function isProjectsAdminOnlyPath(pathname: string): boolean {
  if (pathname === "/projects/projects/new") return true;
  if (pathname.includes("/edit")) return true;
  if (pathname.endsWith("/assign")) return true;
  if (pathname === "/projects/completed-jobs" || pathname.startsWith("/projects/completed-jobs/")) {
    return false;
  }
  // Dashboard is shared by all users
  if (pathname === "/projects") return false;

  for (const href of ADMIN_ONLY_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

/** Landing page for every Projects user (personal or portfolio dashboard). */
export const PROJECTS_MEMBER_HOME = "/projects";
