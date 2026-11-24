"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  GitBranch,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Target,
  UserCog,
  UserPlus,
} from "lucide-react";

import { ModuleSidebar, type ModuleNavItem } from "@/components/layout/module-sidebar";
import {
  getCrmSidebarFocus,
  isCompanyDealWorkspacePath,
  setCrmOpportunityContext,
  setCrmSidebarFocus,
  type CrmSidebarFocus,
} from "@/lib/crm-sidebar-focus";
import { canManageModuleUsers } from "@/lib/module-access";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";


type CrmNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

/**
 * Legacy admin-only CRM panes (kept for route helpers / search filters).
 * These are no longer shown in the primary left nav.
 */
export const CRM_ADMIN_ONLY_HREFS = new Set([
  "/crm/sales-performance",
  "/crm/inventory-aging",
]);

/**
 * Slim CRM left nav: Dashboard, Reports, My Jobs, Company, Leads,
 * Opportunities — plus Users for CRM/ERP admins.
 * Deal docs (quotes, PO, OVF, etc.) live under Company / Opportunity workspaces.
 */
export const CRM_NAV: readonly CrmNavItem[] = [
  { title: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { title: "Reports", href: "/crm/reports", icon: BarChart3 },
  { title: "My Jobs", href: "/crm/my-jobs", icon: ListTodo },
  { title: "Company", href: "/crm/companies", icon: Building2 },
  { title: "Leads", href: "/crm/leads", icon: UserPlus },
  { title: "Opportunities", href: "/crm/opportunities", icon: Target },
  { title: "Timeline", href: "/crm/timeline", icon: GitBranch },
];

export function isCrmAdminOnlyHref(href: string): boolean {
  if (CRM_ADMIN_ONLY_HREFS.has(href)) return true;
  // Alias used by the CRM resource route.
  return href === "/crm/stock-aging";
}

function focusForHref(href: string): CrmSidebarFocus | null {
  if (href === "/crm") return "dashboard";
  if (href === "/crm/companies") return "company";
  if (href === "/crm/leads") return "leads";
  if (href === "/crm/opportunities") return "opportunities";
  return null;
}

function isCrmNavActive(pathname: string, href: string): boolean {
  const focus = getCrmSidebarFocus();

  // Dashboard is exact-match only - `/crm` must not light up for every CRM child route.
  if (href === "/crm") {
    return pathname === "/crm";
  }

  // Company list / overview only - not company section routes (quotes, PO, …).
  if (href === "/crm/companies") {
    if (focus === "opportunities" && isCompanyDealWorkspacePath(pathname)) {
      return false;
    }
    if (pathname === "/crm/companies" || pathname === "/crm/companies/") return true;
    // Company account overview: /crm/companies/{uuid} with no further segment.
    return /^\/crm\/companies\/[^/]+\/?$/.test(pathname) && focus !== "opportunities";
  }

  // Keep Opportunities highlighted while browsing deal docs under a company from an opportunity.
  if (href === "/crm/opportunities") {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (pathname.includes("/quotes") || pathname.includes("/ovf")) return false;
      return true;
    }
    if (focus === "opportunities" && isCompanyDealWorkspacePath(pathname)) {
      return true;
    }
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function onCrmNavigate(item: ModuleNavItem) {
  const focus = focusForHref(item.href);
  if (focus) setCrmSidebarFocus(focus);
  if (focus !== "opportunities") setCrmOpportunityContext(null);
}

/** Left sidebar for the CRM workspace. */
export function CrmSidebar() {
  const pathname = usePathname();
  const { user, adminModuleKeys } = useAuthUser();
  const { settings } = useCrmSettingsEffective();

  const isCrmAdmin = canManageModuleUsers("crm", adminModuleKeys, user?.userType);

  const navItems = useMemo(() => {
    const paneVisibility = new Map(
      (settings?.navigation?.panes ?? []).map((pane) => [pane.href, pane.visible !== false]),
    );
    const items: CrmNavItem[] = CRM_NAV.filter((item) => {
      if (!paneVisibility.size) return true;
      return paneVisibility.get(item.href) !== false;
    });
    if (isCrmAdmin) {
      const usersVisible = !paneVisibility.size || paneVisibility.get("/crm/users") !== false;
      if (usersVisible) {
        items.push({ title: "Users", href: "/crm/users", icon: UserCog });
      }
    }
    return items;
  }, [isCrmAdmin, settings]);

  return (
    <ModuleSidebar
      moduleKey="crm"
      title="Sales CRM"
      subtitle={`${navItems.length} workspace panes`}
      icon={Handshake}
      aria-label="CRM workspace"
      groups={[{ label: "Workspace", items: navItems }]}
      isActive={(item) => isCrmNavActive(pathname, item.href)}
      onItemNavigate={onCrmNavigate}
    />
  );
}
