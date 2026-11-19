/**
 * Standalone HRMS — product navigation lives in hr-nav / HrSidebar.
 * This file remains for any legacy imports that expect shell helpers.
 */

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Boxes,
  LayoutDashboard,
  Shield,
  UserPlus,
  Wallet,
} from "lucide-react";

import type { ErpModule } from "@/config/modules";
import { erpModules } from "@/config/modules";

export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const moduleIconMap: Record<ErpModule["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  shield: Shield,
  building: Building2,
  boxes: Boxes,
  wallet: Wallet,
  hr: Briefcase,
  recruit: UserPlus,
};

/** Legacy shell filter. */
export const HIDDEN_FROM_SHELL_NAV = new Set<string>(["recruitment", "payroll"]);

export function shellSidebarModules(): ErpModule[] {
  return erpModules.filter((m) => m.key === "hr");
}

export const navigation: NavGroup[] = [
  {
    title: "HRMS",
    items: shellSidebarModules().map((mod) => ({
      title: mod.title,
      href: mod.href,
      description: mod.description,
    })),
  },
];

export function filterNavigationGroups(
  groups: NavGroup[],
  _moduleKeys: string[],
  _userType?: string,
  _adminModuleKeys: string[] = [],
): NavGroup[] {
  return groups;
}
