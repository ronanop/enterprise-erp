/**
 * Assets workspace config — aligned with FRD-12 / ERD_15
 * and apps/api asset routers (Category → Disposal).
 */

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardCheck,
  MapPin,
  Package,
  Shield,
  Wrench,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type AssetsWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

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

export const ASSETS_MODULE_KEY = "assets";

export const assetsWorkspaceGroups: AssetsWorkspaceGroup[] = [
  {
    key: "register",
    title: "Register & Structure",
    description: "Categories, assets, components, and locations",
    icon: Boxes,
    resourceKeys: [
      "asset-categories",
      "assets",
      "asset-components",
      "asset-locations",
    ],
  },
  {
    key: "custody",
    title: "Custody & Protection",
    description: "Assignments, transfers, warranties, and insurance",
    icon: Shield,
    resourceKeys: [
      "asset-assignments",
      "asset-transfers",
      "asset-warranties",
      "asset-insurances",
    ],
  },
  {
    key: "lifecycle",
    title: "Maintenance & Valuation",
    description: "Plans, jobs, depreciation, disposal, audits, meters",
    icon: Wrench,
    resourceKeys: [
      "maintenance-plans",
      "asset-maintenances",
      "asset-depreciations",
      "asset-disposals",
      "asset-audits",
      "meter-readings",
    ],
  },
];

/** ERD_15 asset lifecycle (core operational stages) */
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

export function getAssetsResources(): ModuleResource[] {
  return getModule(ASSETS_MODULE_KEY)?.resources ?? [];
}

export function resolveAssetsGroupResources(
  group: AssetsWorkspaceGroup,
): ModuleResource[] {
  const all = getAssetsResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const assetsQuickLinks = [
  {
    title: "Assets",
    href: "/assets/assets",
    description: "Operational register",
    icon: Package,
  },
  {
    title: "Assignments",
    href: "/assets/asset-assignments",
    description: "Custodian custody",
    icon: MapPin,
  },
  {
    title: "Maintenance",
    href: "/assets/asset-maintenances",
    description: "Jobs & schedules",
    icon: Wrench,
  },
  {
    title: "Audits",
    href: "/assets/asset-audits",
    description: "Physical verification",
    icon: ClipboardCheck,
  },
] as const;

export const assetsIcons = {
  Package,
} as const;
