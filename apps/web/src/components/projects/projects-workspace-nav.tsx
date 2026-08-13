"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FolderKanban, Search } from "lucide-react";

import { SidebarAccountSection } from "@/components/layout/sidebar-account-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { filterProjectsNavGroups } from "@/lib/projects/project-module-nav";
import { cn } from "@/lib/utils";

export type ProjectsNavItem = {
  title: string;
  href: string;
  /** Optional workflow stage key for stage list pages. */
  stage?: string;
};

export type ProjectsNavGroup = {
  label: string;
  items: readonly ProjectsNavItem[];
};

/**
 * Site installation delivery nav — replaces generic WBS/timesheet panes
 * with the handwritten Project Management workflow stages.
 */
export const PROJECTS_NAV_GROUPS: readonly ProjectsNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/projects" },
      { title: "My Jobs", href: "/projects/my-jobs" },
      { title: "Follow ups", href: "/projects/follow-ups" },
      { title: "Projects", href: "/projects/projects" },
      { title: "PO Queue", href: "/projects/po-queue" },
      { title: "All Sites", href: "/projects/site-installations" },
    ],
  },
  {
    label: "Delivery stages",
    items: [
      { title: "Intake & RFAI", href: "/projects/intake", stage: "intake" },
      { title: "Assign owners", href: "/projects/assignment", stage: "assignment" },
      { title: "Survey", href: "/projects/survey", stage: "survey" },
      { title: "SCM / Logistics", href: "/projects/scm", stage: "scm" },
      { title: "On-site", href: "/projects/onsite", stage: "onsite" },
      { title: "Installation & Configuration", href: "/projects/installation", stage: "installation" },
      { title: "Acceptance", href: "/projects/acceptance", stage: "acceptance" },
      { title: "Completed", href: "/projects/completed", stage: "completed" },
    ],
  },
] as const;

/** Flat list for search / legacy callers. */
export const PROJECTS_NAV: readonly ProjectsNavItem[] = PROJECTS_NAV_GROUPS.flatMap(
  (g) => g.items,
);

function isProjectsNavActive(pathname: string, href: string): boolean {
  if (href === "/projects") return pathname === "/projects";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontal tab strip (used when Projects shares the main app sidebar). */
export function ProjectsWorkspaceNav() {
  const pathname = usePathname();
  const { projectModuleAdmin } = useAuthUser();
  const navItems = useMemo(
    () => filterProjectsNavGroups(PROJECTS_NAV_GROUPS, projectModuleAdmin).flatMap((g) => g.items),
    [projectModuleAdmin],
  );

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Projects workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {navItems.map((item) => {
            const active = isProjectsNavActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Left sidebar chrome for standalone Projects tabs (replaces AppSidebar). */
export function ProjectsSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const { signedIn, projectModuleAdmin } = useAuthUser();

  const filteredGroups = useMemo(() => {
    const groups = filterProjectsNavGroups(PROJECTS_NAV_GROUPS, projectModuleAdmin);
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, projectModuleAdmin]);

  const paneCount = filteredGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <aside
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {signedIn ? (
        <SidebarAccountSection collapsed={collapsed}>
          <div className="flex items-center gap-2">
            <FolderKanban className="size-3.5 shrink-0 text-sidebar-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">Project Delivery</p>
              <p className="truncate text-[10px] text-sidebar-foreground/55">
                Site installation · {paneCount} panes
              </p>
            </div>
          </div>
        </SidebarAccountSection>
      ) : (
        <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <FolderKanban className="size-4" aria-hidden />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
                Project Delivery
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">
                Site installation · {paneCount} panes
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!collapsed ? (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Projects…"
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
              aria-label="Search Projects panes"
            />
          </div>
        </div>
      ) : null}

      <nav aria-label="Projects workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed ? (
              <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isProjectsNavActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title}
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                      ) : null}
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                      ) : (
                        <span className="text-[10px] font-semibold tracking-wide">
                          {item.title.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand Projects sidebar" : "Collapse Projects sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
