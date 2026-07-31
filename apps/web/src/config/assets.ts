/**
 * Asset Management (PRD v1.0) workspace navigation.
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Package,
  QrCode,
  Settings,
  Tags,
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

export const assetManagementNav: AssetManagementNavGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/assets",
        icon: LayoutDashboard,
        match: "exact",
      },
    ],
  },
  {
    title: "Assets",
    items: [
      { title: "All Assets", href: "/assets/assets", icon: Package, match: "prefix" },
      { title: "Add Asset", href: "/assets/assets/new", icon: Package, match: "exact" },
    ],
  },
  {
    title: "Master Data",
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
      { title: "Maintenance", href: "/assets/asset-maintenances", icon: Wrench },
      { title: "QR / Barcode", href: "/assets/qr-barcode", icon: QrCode },
    ],
  },
  {
    items: [
      { title: "Reports", href: "/assets/reports", icon: BarChart3 },
      { title: "Settings", href: "/assets/settings", icon: Settings },
    ],
  },
];

export function getAssetsResources(): ModuleResource[] {
  return getModule(ASSETS_MODULE_KEY)?.resources ?? [];
}

export const assetsQuickLinks = [
  {
    title: "All Assets",
    href: "/assets/assets",
    description: "Search and manage register",
    icon: Package,
  },
  {
    title: "Add Asset",
    href: "/assets/assets/new",
    description: "Registration wizard",
    icon: Package,
  },
  {
    title: "Assignment",
    href: "/assets/asset-assignments",
    description: "Assign or return custody",
    icon: UserCheck,
  },
  {
    title: "Maintenance",
    href: "/assets/asset-maintenances",
    description: "Work orders",
    icon: Wrench,
  },
] as const;
