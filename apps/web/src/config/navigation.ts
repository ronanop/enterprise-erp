import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileText,
  Handshake,
  Headphones,
  LayoutDashboard,
  Package,
  Plug,
  Scale,
  Shield,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  Briefcase,
  UserPlus,
  FolderKanban,
  Wrench,
} from "lucide-react";

import { erpModules, type ErpModule } from "@/config/modules";

export type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
  /** Navigate inside the main shell (same tab) instead of standalone module tab. */
  inApp?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const iconMap: Record<ErpModule["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  shield: Shield,
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
  grc: Scale,
  analytics: BarChart3,
  integration: Plug,
  ecommerce: Store,
  portal: Activity,
};

const groupTitles: Record<ErpModule["group"], string> = {
  platform: "Overview",
  foundation: "Foundation",
  organization: "Organization",
  "master-data": "Master Data",
  operations: "Operations",
};

export const navigation: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        description: "Platform status and all modules",
        icon: LayoutDashboard,
        inApp: true,
      },
    ],
  },
  ...(["foundation", "organization", "master-data", "operations"] as const).map((group) => ({
    title: groupTitles[group],
    items: [
      ...erpModules
        .filter((m) => m.group === group)
        .map((m) => ({
          title: m.title,
          href: m.href,
          description: m.description,
          icon: iconMap[m.icon],
        })),
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
  })),
];
