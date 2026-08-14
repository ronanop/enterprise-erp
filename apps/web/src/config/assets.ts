/**
 * Asset Management — locked sidebar navigation (module workspaces).
 *
 * Visible sidebar (`assetManagementNav`) is the CURRENT implemented scope only.
 * Future modules remain routed/implemented elsewhere; keep them out of this nav.
 */

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileText,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  QrCode,
  Scale,
  Tags,
  Trash2,
  UserCheck,
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
 * Locked CURRENT-scope sidebar — do not add future modules without product approval.
 * Order: Assets → Configuration → Operations → Lifecycle → Extended.
 */
export const assetManagementNav: AssetManagementNavGroup[] = [
  {
    title: "Assets",
    items: [
      {
        title: "Dashboard",
        href: "/assets",
        icon: LayoutDashboard,
        match: "exact",
      },
      { title: "All Assets", href: "/assets/assets", icon: Package, match: "prefix" },
      { title: "Incoming Assets", href: "/assets/incoming-assets", icon: PackageCheck, match: "exact" },
      {
        title: "Incoming QC",
        href: "/assets/incoming-assets-qc",
        icon: ClipboardCheck,
        match: "prefix",
      },
      {
        title: "Pending Registration",
        href: "/assets/asset-registration",
        icon: PackagePlus,
        match: "prefix",
      },
      { title: "Add Asset", href: "/assets/assets/new", icon: Plus, match: "exact" },
    ],
  },
  {
    title: "Configuration",
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
      { title: "Asset Assignment", href: "/assets/asset-assignments", icon: UserCheck },
      { title: "Transfers", href: "/assets/asset-transfers", icon: ArrowLeftRight },
      { title: "Maintenance", href: "/assets/asset-maintenances", icon: Wrench },
    ],
  },
  {
    title: "Lifecycle",
    items: [{ title: "Disposal", href: "/assets/asset-disposals", icon: Trash2 }],
  },
  {
    title: "Extended",
    items: [
      { title: "Components", href: "/assets/asset-components", icon: Boxes },
      { title: "Documents", href: "/assets/asset-documents", icon: FileText },
      { title: "QR / Barcode", href: "/assets/qr-barcode", icon: QrCode },
      { title: "Reports", href: "/assets/reports", icon: BarChart3 },
    ],
  },
];

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
    title: "All Assets",
    href: "/assets/assets",
    description: "Search and manage register",
    icon: Package,
  },
  {
    title: "Transfers",
    href: "/assets/asset-transfers",
    description: "Move custody or branch",
    icon: ArrowLeftRight,
  },
  {
    title: "Maintenance",
    href: "/assets/asset-maintenances",
    description: "Work orders",
    icon: Wrench,
  },
  {
    title: "Audits",
    href: "/assets/asset-audits",
    description: "Physical verification",
    icon: ClipboardCheck,
  },
] as const;

