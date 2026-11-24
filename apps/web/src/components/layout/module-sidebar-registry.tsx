import type { ReactNode } from "react";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { WorkspaceModuleSidebar } from "@/components/layout/workspace-module-sidebar";
import { MarketingSidebar } from "@/components/marketing/marketing-workspace-nav";
import { ProcurementSidebar } from "@/components/procurement/procurement-workspace-nav";
import { ProjectsSidebar } from "@/components/projects/projects-workspace-nav";
import { ServiceSidebar } from "@/components/service/service-workspace-nav";
import { WORKSPACE_SIDEBARS } from "@/config/workspace-sidebars";

type SidebarEntry = { root: string; render: () => ReactNode };

/**
 * Module workspace roots that own a left sidebar. Modules with special nav logic
 * have their own `ModuleSidebar` wrapper; the rest are config in `WORKSPACE_SIDEBARS`.
 */
const MODULE_SIDEBARS: readonly SidebarEntry[] = [
  { root: "/crm", render: () => <CrmSidebar /> },
  { root: "/projects", render: () => <ProjectsSidebar /> },
  { root: "/procurement", render: () => <ProcurementSidebar /> },
  { root: "/assets", render: () => <AssetsModuleSidebar /> },
  { root: "/service", render: () => <ServiceSidebar /> },
  { root: "/marketing", render: () => <MarketingSidebar /> },
  ...WORKSPACE_SIDEBARS.map((config) => ({
    root: config.root,
    render: () => <WorkspaceModuleSidebar config={config} />,
  })),
];

function underRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

type ShellSidebarInput = {
  pathname: string;
  standalone: boolean;
  /** Focus modes such as the asset QR scan portal. */
  hideSidebar?: boolean;
};

/**
 * Which left sidebar the route gets: `"app"` (global rail), a module
 * workspace root such as `"/crm"`, or `null` for none.
 * HRMS UI was removed from this ERP (separate app + employee API import only).
 */
export function resolveShellSidebarKey({
  pathname,
  standalone,
  hideSidebar = false,
}: ShellSidebarInput): string | null {
  if (hideSidebar) return null;
  if (!standalone) return "app";
  return MODULE_SIDEBARS.find((entry) => underRoot(pathname, entry.root))?.root ?? null;
}

/** Left sidebar for the current route. Module workspaces and platform routes each get their rail. */
export function ShellSidebar(props: ShellSidebarInput) {
  const key = resolveShellSidebarKey(props);
  if (key === null) return null;
  if (key === "app") return <AppSidebar />;
  return MODULE_SIDEBARS.find((entry) => entry.root === key)?.render() ?? null;
}
