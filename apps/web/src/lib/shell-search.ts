/**
 * Resolves topbar search scope from the current path: home module finder,
 * or the active module's workspace panes.
 */

import { CRM_NAV } from "@/components/crm/crm-workspace-nav";
import { MARKETING_NAV } from "@/components/marketing/marketing-workspace-nav";
import { ALL_PROCUREMENT_NAV } from "@/components/procurement/procurement-workspace-nav";
import { PROJECTS_NAV } from "@/components/projects/projects-workspace-nav";
import { SERVICE_NAV } from "@/components/service/service-workspace-nav";
import {
  assetDomainSwitcherItems,
  itAssetWorkspaceNav,
  nonItAssetWorkspaceNav,
} from "@/config/assets";
import type { NavItem } from "@/config/navigation";
import { WORKSPACE_SIDEBARS } from "@/config/workspace-sidebars";

export type ShellSearchHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords?: string;
};

export type ShellSearchScope =
  | { mode: "crm" }
  | { mode: "projects" }
  | { mode: "home"; placeholder: string }
  | { mode: "panes"; moduleTitle: string; placeholder: string; panes: ShellSearchHit[] };

function underRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function assetPanes(): ShellSearchHit[] {
  const out: ShellSearchHit[] = [];
  for (const item of assetDomainSwitcherItems) {
    out.push({
      id: `assets:switch:${item.href}:${item.title}`,
      title: item.title,
      subtitle: "Domain",
      href: item.href,
    });
  }
  for (const group of [...itAssetWorkspaceNav, ...nonItAssetWorkspaceNav]) {
    for (const item of group.items) {
      out.push({
        id: `assets:${item.href}:${item.title}`,
        title: item.title,
        subtitle: group.title,
        href: item.href,
      });
    }
  }
  return out;
}

function workspacePanes(root: string, title: string): ShellSearchHit[] | null {
  const config = WORKSPACE_SIDEBARS.find((entry) => entry.root === root);
  if (!config) return null;
  return config.items.map((item) => ({
    id: `${config.moduleKey}:${item.href}`,
    title: item.title,
    subtitle: title,
    href: item.href,
  }));
}

/** Static pane catalog for a module root (CRM / Projects use dedicated search UIs). */
export function modulePaneCatalog(pathname: string): {
  moduleTitle: string;
  panes: ShellSearchHit[];
} | null {
  if (underRoot(pathname, "/marketing")) {
    return {
      moduleTitle: "Marketing",
      panes: MARKETING_NAV.map((item) => ({
        id: `marketing:${item.href}`,
        title: item.title,
        subtitle: "Marketing",
        href: item.href,
      })),
    };
  }
  if (underRoot(pathname, "/service")) {
    return {
      moduleTitle: "Service",
      panes: SERVICE_NAV.map((item) => ({
        id: `service:${item.href}`,
        title: item.title,
        subtitle: "Service",
        href: item.href,
      })),
    };
  }
  if (underRoot(pathname, "/procurement")) {
    return {
      moduleTitle: "Procurement",
      panes: ALL_PROCUREMENT_NAV.map((item) => ({
        id: `procurement:${item.href}`,
        title: item.title,
        subtitle: "Procurement",
        href: item.href,
      })),
    };
  }
  if (underRoot(pathname, "/assets")) {
    return { moduleTitle: "Assets", panes: assetPanes() };
  }
  if (underRoot(pathname, "/crm")) {
    return {
      moduleTitle: "CRM",
      panes: CRM_NAV.map((item) => ({
        id: `crm:${item.href}`,
        title: item.title,
        subtitle: "CRM",
        href: item.href,
      })),
    };
  }
  if (underRoot(pathname, "/projects")) {
    return {
      moduleTitle: "Projects",
      panes: PROJECTS_NAV.map((item) => ({
        id: `projects:${item.href}`,
        title: item.title,
        subtitle: "Projects",
        href: item.href,
      })),
    };
  }

  for (const config of WORKSPACE_SIDEBARS) {
    if (underRoot(pathname, config.root)) {
      const panes = workspacePanes(config.root, config.title);
      if (panes) return { moduleTitle: config.title, panes };
    }
  }

  return null;
}

/** Home / platform rail: searchable ERP modules from the global navigation config. */
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
  if (underRoot(pathname, "/crm")) return { mode: "crm" };
  if (underRoot(pathname, "/projects")) return { mode: "projects" };

  const catalog = modulePaneCatalog(pathname);
  if (catalog) {
    return {
      mode: "panes",
      moduleTitle: catalog.moduleTitle,
      placeholder: `Search ${catalog.moduleTitle}…`,
      panes: catalog.panes,
    };
  }

  return { mode: "home", placeholder: "Search modules…" };
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
