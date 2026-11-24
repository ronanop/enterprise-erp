import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileText,
  Handshake,
  Headphones,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Package,
  Shield,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  Briefcase,
  ListTodo,
  UserPlus,
  FolderKanban,
  Wrench,
} from "lucide-react";

import { erpModules, type ErpModule } from "@/config/modules";

/** Office Microsoft Form — opens outside the ERP shell. */
export const FEEDBACK_FORM_URL =
  "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=wYYSMPwX2kiEseoRX2d4tKRY4d-KeFJLoGvKu8A4eYlUMUowWkswNlBHUzI4N0VFTlpHNEJZOVBHTC4u";

export type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
  /** Keep navigation in the current tab inside the ERP shell. Operations modules open in a new tab. */
  inApp?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const moduleIconMap: Record<ErpModule["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  shield: Shield,
  mail: Mail,
  voice: Mic,
  building: Building2,
  boxes: Boxes,
  wallet: Wallet,
  cart: ShoppingCart,
  truck: Truck,
  package: Package,
  factory: Factory,
  quality: ClipboardCheck,
  crm: Handshake,
  hr: Briefcase,
  payroll: Wallet,
  recruit: UserPlus,
  project: FolderKanban,
  asset: Wrench,
  service: Headphones,
  helpdesk: Headphones,
  document: FileText,
  marketing: Megaphone,
  analytics: BarChart3,
  ecommerce: Store,
};

const groupTitles: Record<ErpModule["group"], string> = {
  platform: "Overview",
  foundation: "Foundation",
  organization: "Organization",
  "master-data": "Master Data",
  operations: "Operations",
};

/** Foundation, organization, and master data stay in the ERP shell; operations open in a new tab. */
const IN_APP_NAV_GROUPS = new Set<ErpModule["group"]>(["foundation", "organization", "master-data"]);

/**
 * Modules kept in the registry but omitted from the ERP shell sidebar (and home Departments table).
 * HRMS (`hr`) + nested payroll/recruitment run as a separate app; ERP only fetches employees via API.
 * Parent Assets shell is hidden — IT / Non-IT are assigned and shown separately.
 */
export const HIDDEN_FROM_SHELL_NAV = new Set<string>([
  "hr",
  "recruitment",
  "payroll",
  "inventory",
  "assets",
]);

const SHELL_NAV_GROUPS = ["foundation", "organization", "master-data", "operations"] as const;

/** ERP modules shown in the left sidebar, in sidebar order (ops alphabetical). */
export function shellSidebarModules(): ErpModule[] {
  const rows: ErpModule[] = [];
  for (const group of SHELL_NAV_GROUPS) {
    const moduleItems = erpModules.filter(
      (m) => m.group === group && !HIDDEN_FROM_SHELL_NAV.has(m.key),
    );
    if (group === "operations") {
      rows.push(
        ...[...moduleItems].sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
        ),
      );
    } else {
      rows.push(...moduleItems);
    }
  }
  return rows;
}

export const navigation: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/home",
        description: "Platform status and all modules",
        icon: LayoutDashboard,
        inApp: true,
      },
      {
        title: "Admin panel",
        href: "/admin",
        description: "Platform configuration and access control",
        icon: Shield,
        inApp: true,
      },
      {
        title: "My Jobs",
        href: "/my-jobs",
        description: "Approvals and assigned work across your modules",
        icon: ListTodo,
        inApp: true,
      },
    ],
  },
  ...SHELL_NAV_GROUPS.map((group) => {
    const moduleItems = erpModules
      .filter((m) => m.group === group && !HIDDEN_FROM_SHELL_NAV.has(m.key))
      .map((m) => ({
        title: m.title,
        href: m.href,
        description: m.description,
        icon: moduleIconMap[m.icon],
        inApp: IN_APP_NAV_GROUPS.has(group),
      }));
    // Operations sidebar: alphabetical by label (Analytics, Asset Management, …).
    const items =
      group === "operations"
        ? [...moduleItems].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
        : moduleItems;
    return {
      title: groupTitles[group],
      items: [
        ...items,
        ...(group === "organization"
          ? [
            {
              title: "Users",
              href: "/organization/users",
              description: "ERP users in your organization tenant",
              icon: Users,
              inApp: true,
            } satisfies NavItem,
          ]
          : []),
      ],
    };
  }),
  {
    title: "Feedback",
    items: [
      {
        title: "Feedback",
        href: FEEDBACK_FORM_URL,
        description: "Share feedback about iConnect Plus",
        icon: MessageSquare,
        inApp: false,
      },
    ],
  },
];
