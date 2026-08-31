/**
 * Asset Management — domain-picker sidebar + per-domain workspace nav.
 *
 * Top level: IT Assets | Non-IT Assets.
 * Active domain expands its workspace tabs; Users nests at the end when
 * the viewer is a domain admin (or module admin).
 */

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MapPin,
  Monitor,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  QrCode,
  Scale,
  ScrollText,
  Tags,
  Trash2,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export const ASSETS_MODULE_KEY = "assets";

export type AssetDomainKey = "IT" | "NON_IT";

export type AssetManagementNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match exact path or prefix for nested routes */
  match?: "exact" | "prefix";
  /** Nested Users tab — shown only for domain/module admins */
  requiresDomainAdmin?: boolean;
};

export type AssetManagementNavGroup = {
  title?: string;
  /** Top-level domain switcher entry */
  domainSwitcher?: AssetDomainKey;
  /** Subordinate workspace groups for a domain */
  domain?: AssetDomainKey;
  items: AssetManagementNavItem[];
};

export function isAssetNavActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "prefix",
): boolean {
  const hrefPath = href.split("?")[0] ?? href;
  if (hrefPath === "/assets") {
    return pathname === "/assets";
  }
  if (hrefPath === "/assets/non-it/inventory") {
    if (pathname === "/assets/non-it/inventory" || pathname.startsWith("/assets/non-it/inventory/")) {
      return true;
    }
    if (pathname === "/assets/non-it/new") return true;
    const detail = pathname.match(/^\/assets\/non-it\/([^/]+)$/);
    if (detail) {
      const seg = detail[1] ?? "";
      return !["types", "locations", "inventory", "new"].includes(seg);
    }
    return false;
  }
  if (match === "exact") {
    return pathname === hrefPath;
  }
  if (pathname === hrefPath) return true;
  if (hrefPath === "/assets/assets" && pathname.startsWith("/assets/assets/new")) {
    return false;
  }
  return pathname.startsWith(`${hrefPath}/`);
}

/** Derive active domain from the current Assets path. */
export function activeAssetDomainFromPath(pathname: string): AssetDomainKey | null {
  if (!pathname.startsWith("/assets")) return null;
  if (pathname === "/assets/non-it" || pathname.startsWith("/assets/non-it/")) {
    return "NON_IT";
  }
  if (pathname.startsWith("/assets/users")) {
    return null; // resolved via ?domain= in sidebar
  }
  return "IT";
}

/** Top-level domain switcher only. */
export const assetDomainSwitcherNav: AssetManagementNavGroup[] = [
  {
    title: "Domains",
    items: [
      {
        title: "IT Assets",
        href: "/assets",
        icon: Package,
        match: "exact",
      },
      {
        title: "Non-IT Assets",
        href: "/assets/non-it",
        icon: Monitor,
        match: "prefix",
      },
    ],
  },
];

/** Mark switcher items with domain for gating. */
export const assetDomainSwitcherItems: (AssetManagementNavItem & {
  domain: AssetDomainKey;
})[] = [
  { title: "IT Assets", href: "/assets", icon: Package, match: "exact", domain: "IT" },
  {
    title: "Non-IT Assets",
    href: "/assets/non-it",
    icon: Monitor,
    match: "prefix",
    domain: "NON_IT",
  },
];

/** IT workspace tabs (existing scope). */
export const itAssetWorkspaceNav: AssetManagementNavGroup[] = [
  {
    title: "IT Assets",
    domain: "IT",
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
    domain: "IT",
    items: [
      { title: "Asset Types", href: "/assets/asset-types", icon: Tags },
      { title: "Locations", href: "/assets/locations", icon: MapPin },
      { title: "Departments", href: "/assets/departments", icon: UserCheck },
    ],
  },
  {
    title: "Operations",
    domain: "IT",
    items: [
      { title: "Asset Assignment", href: "/assets/asset-assignments", icon: UserCheck },
      { title: "DC Challan", href: "/assets/asset-dc-challans", icon: ScrollText },
      { title: "Transfers", href: "/assets/asset-transfers", icon: ArrowLeftRight },
      { title: "Maintenance", href: "/assets/asset-maintenances", icon: Wrench },
    ],
  },
  {
    title: "Lifecycle",
    domain: "IT",
    items: [{ title: "Disposal", href: "/assets/asset-disposals", icon: Trash2 }],
  },
  {
    title: "Extended",
    domain: "IT",
    items: [
      { title: "Components", href: "/assets/asset-components", icon: Boxes },
      { title: "Documents", href: "/assets/asset-documents", icon: FileText },
      { title: "QR / Barcode", href: "/assets/qr-barcode", icon: QrCode },
      { title: "Reports", href: "/assets/reports", icon: BarChart3 },
      {
        title: "Users",
        href: "/assets/users?domain=IT",
        icon: Users,
        match: "prefix",
        requiresDomainAdmin: true,
      },
    ],
  },
];

/** Non-IT workspace (dashboard + inventory + types + locations + nested Users). */
export const nonItAssetWorkspaceNav: AssetManagementNavGroup[] = [
  {
    title: "Non-IT Assets",
    domain: "NON_IT",
    items: [
      {
        title: "Dashboard",
        href: "/assets/non-it",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        title: "Inventory",
        href: "/assets/non-it/inventory",
        icon: Package,
        match: "prefix",
      },
      {
        title: "Types",
        href: "/assets/non-it/types",
        icon: Tags,
        match: "prefix",
        requiresDomainAdmin: true,
      },
      {
        title: "Locations",
        href: "/assets/non-it/locations",
        icon: MapPin,
        match: "prefix",
        requiresDomainAdmin: true,
      },
      {
        title: "Users",
        href: "/assets/users?domain=NON_IT",
        icon: Users,
        match: "prefix",
        requiresDomainAdmin: true,
      },
    ],
  },
];

/**
 * Flat export kept for tests / workspace-nav consumers that expect a single list.
 * Prefer buildAssetSidebarNav for the sidebar.
 */
export const assetManagementNav: AssetManagementNavGroup[] = [
  ...itAssetWorkspaceNav,
  ...nonItAssetWorkspaceNav,
];

export type AssetNavAccess = {
  isModuleAdmin: boolean;
  domains: string[];
  adminDomains: string[];
  activeDomain: AssetDomainKey | null;
};

/** Build sidebar: domain switcher + active domain workspace (Users if admin). */
export function buildAssetSidebarNav(access: AssetNavAccess): AssetManagementNavGroup[] {
  const domainSet = new Set(access.domains.map((d) => d.toUpperCase()));
  const adminSet = new Set(access.adminDomains.map((d) => d.toUpperCase()));
  const canSee = (domain: AssetDomainKey) =>
    access.isModuleAdmin || domainSet.has(domain);
  const canAdmin = (domain: AssetDomainKey) =>
    access.isModuleAdmin || adminSet.has(domain);

  const switcherItems = assetDomainSwitcherItems.filter((item) => canSee(item.domain));
  if (switcherItems.length === 0) {
    return [];
  }

  const groups: AssetManagementNavGroup[] = [
    {
      title: "Domains",
      items: switcherItems.map(({ domain: _d, ...item }) => item),
    },
  ];

  const active = access.activeDomain;
  if (!active || !canSee(active)) {
    return groups;
  }

  const workspace =
    active === "NON_IT" ? nonItAssetWorkspaceNav : itAssetWorkspaceNav;
  const showUsers = canAdmin(active);

  for (const group of workspace) {
    const items = group.items.filter((item) => {
      if (item.requiresDomainAdmin) return showUsers;
      return true;
    });
    if (items.length === 0) continue;
    groups.push({ ...group, items });
  }

  return groups;
}

/** @deprecated Use buildAssetSidebarNav */
export function filterAssetManagementNav(
  groups: AssetManagementNavGroup[],
  opts: { isModuleAdmin: boolean; domains: string[] },
): AssetManagementNavGroup[] {
  return buildAssetSidebarNav({
    isModuleAdmin: opts.isModuleAdmin,
    domains: opts.domains,
    adminDomains: opts.isModuleAdmin ? ["IT", "NON_IT"] : [],
    activeDomain: "IT",
  });
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
    description: "Types, locations, and departments",
    icon: Tags,
    resourceKeys: ["asset-types", "locations", "departments"],
  },
  {
    key: "operations",
    title: "Operations",
    description: "Assignment, DC challans, transfers, and maintenance",
    icon: Wrench,
    resourceKeys: ["asset-assignments", "asset-dc-challans", "asset-transfers", "asset-maintenances"],
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
    | "assets"
    | "asset-assignments"
    | "asset-maintenances"
    | "asset-depreciations"
    | "asset-disposals";
};

/** Asset lifecycle funnel on the dashboard (counts from overview API). */
export const assetsPipelineStages: AssetsPipelineStage[] = [
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
