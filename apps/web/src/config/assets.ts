/**
 * Asset Management — sidebar navigation (module workspaces).
 *
 * Full catalog is shown in the sidebar (MVP three-item trim removed).
 */

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  FileText,
  FolderTree,
  Gauge,
  History,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MapPinned,
  Package,
  PackagePlus,
  QrCode,
  Scale,
  Settings,
  Shield,
  Tags,
  Trash2,
  TrendingUp,
  Umbrella,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export const ASSETS_MODULE_KEY = "assets";

export type AssetManagementNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match exact path or prefix for nested routes */
  match?: "exact" | "prefix";
};

export type AssetManagementNavGroup = {
  title?: string;
  items: AssetManagementNavItem[];
};

/**
 * Full navigation catalog — keep in sync with module resources.
 */
export const assetManagementNavCatalog: AssetManagementNavGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/assets",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        title: "Asset Operations",
        href: "/assets/operations",
        icon: Gauge,
        match: "exact",
      },
    ],
  },
  {
    title: "Assets",
    items: [
      { title: "Asset Register", href: "/assets/assets", icon: Package, match: "prefix" },
      { title: "Add Asset", href: "/assets/assets/new", icon: PackagePlus, match: "exact" },
    ],
  },
  {
    title: "Asset Configuration",
    items: [
      { title: "Categories", href: "/assets/asset-categories", icon: FolderTree },
      { title: "Asset Types", href: "/assets/asset-types", icon: Tags },
      { title: "Locations", href: "/assets/locations", icon: MapPin },
      { title: "Departments", href: "/assets/departments", icon: UserCheck },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Asset Allocation", href: "/assets/asset-assignments", icon: Users },
      { title: "Transfers", href: "/assets/asset-transfers", icon: ArrowLeftRight },
      { title: "Maintenance", href: "/assets/asset-maintenances", icon: Wrench },
    ],
  },
  {
    title: "Lifecycle",
    items: [
      { title: "Depreciation", href: "/assets/asset-depreciations", icon: Scale },
      { title: "Disposals", href: "/assets/asset-disposals", icon: Trash2 },
      { title: "Revaluation", href: "/assets/asset-revaluations", icon: TrendingUp },
    ],
  },
  {
    title: "Compliance",
    items: [
      { title: "Audits", href: "/assets/asset-audits", icon: ClipboardCheck },
      { title: "Warranties", href: "/assets/asset-warranties", icon: Shield },
      { title: "Insurance", href: "/assets/asset-insurances", icon: Umbrella },
    ],
  },
  {
    title: "Extended",
    items: [
      { title: "Components", href: "/assets/asset-components", icon: Boxes },
      { title: "Asset Locations", href: "/assets/asset-locations", icon: MapPinned },
      { title: "Maintenance Plans", href: "/assets/maintenance-plans", icon: CalendarClock },
      { title: "Service History", href: "/assets/service-histories", icon: History },
      { title: "Checklists", href: "/assets/asset-checklists", icon: ListChecks },
      { title: "Meter Readings", href: "/assets/meter-readings", icon: Gauge },
      { title: "Documents", href: "/assets/asset-documents", icon: FileText },
      { title: "Notifications", href: "/assets/asset-notifications", icon: Bell },
    ],
  },
  {
    items: [{ title: "QR / Barcode", href: "/assets/qr-barcode", icon: QrCode }],
  },
  {
    items: [{ title: "Reports", href: "/assets/reports", icon: BarChart3 }],
  },
  {
    items: [{ title: "Settings", href: "/assets/settings", icon: Settings }],
  },
];

/** Active sidebar — full Asset Management operations catalog. */
export const assetManagementNav: AssetManagementNavGroup[] = assetManagementNavCatalog;

/** Flat link list for secondary workspace tabs. */
export function getAssetManagementNavItems(): AssetManagementNavItem[] {
  return assetManagementNav.flatMap((group) => group.items);
}

export function getAssetsResources(): ModuleResource[] {
  return getModule(ASSETS_MODULE_KEY)?.resources ?? [];
}

export type AssetsWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

/** Dashboard workspace cards — aligned with locked sidebar sections. */
export const assetsWorkspaceGroups: AssetsWorkspaceGroup[] = [
  {
    key: "configuration",
    title: "Asset Configuration",
    description: "Categories, types, locations, and departments",
    icon: FolderTree,
    resourceKeys: ["asset-categories", "asset-types", "locations", "departments"],
  },
  {
    key: "operations",
    title: "Operations",
    description: "Assignment, transfers, and maintenance",
    icon: Wrench,
    resourceKeys: ["asset-assignments", "asset-transfers", "asset-maintenances"],
  },
  {
    key: "lifecycle",
    title: "Lifecycle",
    description: "Depreciation, disposal, and revaluation",
    icon: Scale,
    resourceKeys: ["asset-depreciations", "asset-disposals", "asset-revaluations"],
  },
  {
    key: "compliance",
    title: "Compliance",
    description: "Audits, warranties, and insurance",
    icon: ClipboardCheck,
    resourceKeys: ["asset-audits", "asset-warranties", "asset-insurances"],
  },
  {
    key: "extended",
    title: "Extended",
    description: "Components, plans, history, and documents",
    icon: Boxes,
    resourceKeys: [
      "asset-components",
      "asset-locations",
      "maintenance-plans",
      "service-histories",
      "asset-checklists",
      "meter-readings",
      "asset-documents",
      "asset-notifications",
    ],
  },
];

export function resolveAssetsGroupResources(group: AssetsWorkspaceGroup): ModuleResource[] {
  const all = getAssetsResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export type AssetsPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "asset-categories"
    | "assets"
    | "asset-assignments"
    | "asset-maintenances"
    | "asset-depreciations"
    | "asset-disposals";
};

/** Asset lifecycle funnel on the dashboard (counts from overview API). */
export const assetsPipelineStages: AssetsPipelineStage[] = [
  {
    key: "category",
    title: "Category",
    href: "/assets/asset-categories",
    resource: "asset-categories",
  },
  {
    key: "asset",
    title: "Asset",
    href: "/assets/assets",
    resource: "assets",
  },
  {
    key: "assignment",
    title: "Assignment",
    href: "/assets/asset-assignments",
    resource: "asset-assignments",
  },
  {
    key: "maintenance",
    title: "Maintenance",
    href: "/assets/asset-maintenances",
    resource: "asset-maintenances",
  },
  {
    key: "depreciation",
    title: "Depreciation",
    href: "/assets/asset-depreciations",
    resource: "asset-depreciations",
  },
  {
    key: "disposal",
    title: "Disposal",
    href: "/assets/asset-disposals",
    resource: "asset-disposals",
  },
];

export const assetsQuickLinks = [
  {
    title: "Dashboard",
    href: "/assets",
    description: "Module hub and workspace cards",
    icon: LayoutDashboard,
  },
  {
    title: "Asset Operations",
    href: "/assets/operations",
    description: "KPIs, queues, and live register",
    icon: Gauge,
  },
  {
    title: "Asset Register",
    href: "/assets/assets",
    description: "Search and manage register",
    icon: Package,
  },
  {
    title: "Add Asset",
    href: "/assets/assets/new",
    description: "Register a new asset",
    icon: PackagePlus,
  },
  {
    title: "Asset Allocation",
    href: "/assets/asset-assignments",
    description: "Assign and return assets",
    icon: Users,
  },
  {
    title: "Transfers",
    href: "/assets/asset-transfers",
    description: "Move assets between locations",
    icon: ArrowLeftRight,
  },
  {
    title: "Maintenance",
    href: "/assets/asset-maintenances",
    description: "Work orders and upkeep",
    icon: Wrench,
  },
  {
    title: "Disposals",
    href: "/assets/asset-disposals",
    description: "Retire and dispose assets",
    icon: Trash2,
  },
  {
    title: "Reports",
    href: "/assets/reports",
    description: "Asset analytics and exports",
    icon: BarChart3,
  },
] as const;
