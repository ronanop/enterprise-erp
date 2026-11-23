/**
 * Topbar search for standalone HRMS — HR navigation panes.
 */

import { hrNavGroups, type HrNavItem } from "@/config/hr-nav";
import type { NavItem } from "@/config/navigation";

export type ShellSearchHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords?: string;
};

export type ShellSearchScope =
  | { mode: "home"; placeholder: string }
  | { mode: "panes"; moduleTitle: string; placeholder: string; panes: ShellSearchHit[] };

function flattenHrItems(items: readonly HrNavItem[], groupLabel: string): ShellSearchHit[] {
  const out: ShellSearchHit[] = [];
  for (const item of items) {
    if (!item.expandOnly) {
      out.push({
        id: `hr:${item.href}`,
        title: item.title,
        subtitle: groupLabel,
        href: item.href,
        keywords: item.description,
      });
    }
    for (const child of item.children ?? []) {
      out.push({
        id: `hr:${child.href}:${child.title}`,
        title: child.title,
        subtitle: `${groupLabel} · ${item.title}`,
        href: child.href,
        keywords: child.description,
      });
    }
  }
  return out;
}

function hrPanes(): ShellSearchHit[] {
  return hrNavGroups.flatMap((group) => flattenHrItems(group.items, group.label || "HRMS"));
}

/** HRMS pane catalog. Every signed-in route searches the HR sidebar. */
export function modulePaneCatalog(_pathname: string): {
  moduleTitle: string;
  panes: ShellSearchHit[];
} {
  return { moduleTitle: "HRMS", panes: hrPanes() };
}

/** Home / platform rail: searchable links from the shell catalog. */
export function homeModuleHits(items: readonly NavItem[]): ShellSearchHit[] {
  return items.map((item) => ({
    id: `module:${item.href}`,
    title: item.title,
    subtitle: item.description ?? "Module",
    href: item.href,
    keywords: item.description,
  }));
}

export function resolveShellSearchScope(pathname: string): ShellSearchScope {
  if (pathname === "/home" || pathname === "/") {
    return { mode: "home", placeholder: "Search HRMS…" };
  }
  const catalog = modulePaneCatalog(pathname);
  return {
    mode: "panes",
    moduleTitle: catalog.moduleTitle,
    placeholder: `Search ${catalog.moduleTitle}…`,
    panes: catalog.panes,
  };
}

export function filterShellHits(panes: readonly ShellSearchHit[], query: string): ShellSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return panes
    .filter(
      (hit) =>
        hit.title.toLowerCase().includes(q) ||
        hit.subtitle.toLowerCase().includes(q) ||
        Boolean(hit.keywords?.toLowerCase().includes(q)),
    )
    .slice(0, 24);
}
