/**
 * Manufacturing workspace config — aligned with FRD-13 screen inventory
 * and apps/api manufacturing routers (BOM → Order → Issue → WIP → Receipt).
 */

import type { LucideIcon } from "lucide-react";
import {
  Cog,
  Factory,
  FileStack,
  Layers,
  PackageMinus,
  PackagePlus,
  Settings2,
  Trash2,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type ManufacturingWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type ManufacturingPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "production-orders"
    | "material-issues"
    | "wip"
    | "production-receipts"
    | "scrap";
};

export const MANUFACTURING_MODULE_KEY = "manufacturing";

export const manufacturingWorkspaceGroups: ManufacturingWorkspaceGroup[] = [
  {
    key: "master",
    title: "Engineering Masters",
    description: "BOMs, routings, work centers, and machines",
    icon: Settings2,
    resourceKeys: ["boms", "routings", "work-centers", "machines"],
  },
  {
    key: "execution",
    title: "Shop Floor Execution",
    description: "Production orders, material issues/returns, and receipts",
    icon: Factory,
    resourceKeys: ["production-orders", "material-issues", "material-returns", "production-receipts"],
  },
  {
    key: "costing",
    title: "Costing & Scrap",
    description: "WIP balances, scrap, and production variances",
    icon: Layers,
    resourceKeys: ["wip", "scrap", "variances"],
  },
];

/** FRD-13 manufacturing lifecycle (core operational stages) */
export const manufacturingPipelineStages: ManufacturingPipelineStage[] = [
  {
    key: "order",
    title: "Production Order",
    href: "/manufacturing/production-orders",
    resource: "production-orders",
  },
  {
    key: "issue",
    title: "Material Issue",
    href: "/manufacturing/material-issues",
    resource: "material-issues",
  },
  { key: "wip", title: "WIP", href: "/manufacturing/wip", resource: "wip" },
  {
    key: "receipt",
    title: "FG Receipt",
    href: "/manufacturing/production-receipts",
    resource: "production-receipts",
  },
  { key: "scrap", title: "Scrap", href: "/manufacturing/scrap", resource: "scrap" },
];

export function getManufacturingResources(): ModuleResource[] {
  return getModule(MANUFACTURING_MODULE_KEY)?.resources ?? [];
}

export function resolveManufacturingGroupResources(
  group: ManufacturingWorkspaceGroup,
): ModuleResource[] {
  const all = getManufacturingResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const manufacturingQuickLinks = [
  {
    title: "BOMs",
    href: "/manufacturing/boms",
    description: "Product structures",
    icon: FileStack,
  },
  {
    title: "Production Orders",
    href: "/manufacturing/production-orders",
    description: "Work order book",
    icon: Factory,
  },
  {
    title: "Material Issues",
    href: "/manufacturing/material-issues",
    description: "Issue to floor",
    icon: PackageMinus,
  },
  {
    title: "FG Receipts",
    href: "/manufacturing/production-receipts",
    description: "Finished goods",
    icon: PackagePlus,
  },
] as const;

export const manufacturingIcons = {
  Cog,
  Trash2,
} as const;
