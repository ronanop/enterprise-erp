/**
 * Inventory workspace config — aligned with FRD-08 screen inventory
 * and apps/api inventory routers.
 */

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  Package,
  PackageSearch,
  Scale,
  Shuffle,
  Warehouse,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type InventoryWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type InventoryReportTab = {
  key: "stock-summary" | "batch-expiry";
  title: string;
  description: string;
  apiPath: string;
};

export const INVENTORY_MODULE_KEY = "inventory";

export const inventoryWorkspaceGroups: InventoryWorkspaceGroup[] = [
  {
    key: "stock",
    title: "Stock & Locations",
    description: "On-hand balances, bins, and reorder policies",
    icon: Warehouse,
    resourceKeys: ["stock", "bins", "policies"],
  },
  {
    key: "traceability",
    title: "Traceability",
    description: "Batches, serials, and reservations",
    icon: PackageSearch,
    resourceKeys: ["batches", "serials", "reservations"],
  },
  {
    key: "movements",
    title: "Movements",
    description: "Transfers, adjustments, and cycle counts",
    icon: Shuffle,
    resourceKeys: ["transfers", "adjustments", "cycle-counts"],
  },
  {
    key: "valuation",
    title: "Valuation & Reports",
    description: "Cost layers and inventory reports",
    icon: Scale,
    resourceKeys: ["valuation", "reports"],
  },
];

export const inventoryReportTabs: InventoryReportTab[] = [
  {
    key: "stock-summary",
    title: "Stock Summary",
    description: "On-hand and available quantities by product/warehouse",
    apiPath: "/inventory/reports/stock-summary",
  },
  {
    key: "batch-expiry",
    title: "Batch Expiry",
    description: "Batch expiry watchlist",
    apiPath: "/inventory/reports/batch-expiry",
  },
];

export function getInventoryResources(): ModuleResource[] {
  return getModule(INVENTORY_MODULE_KEY)?.resources ?? [];
}

export function resolveInventoryGroupResources(
  group: InventoryWorkspaceGroup,
): ModuleResource[] {
  const all = getInventoryResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const inventoryQuickLinks = [
  {
    title: "Stock",
    href: "/inventory/stock",
    description: "On-hand balances",
    icon: Package,
  },
  {
    title: "Transfers",
    href: "/inventory/transfers",
    description: "Warehouse moves",
    icon: Shuffle,
  },
  {
    title: "Adjustments",
    href: "/inventory/adjustments",
    description: "Qty corrections",
    icon: ClipboardList,
  },
  {
    title: "Valuation",
    href: "/inventory/valuation",
    description: "Cost layers",
    icon: Boxes,
  },
] as const;

export const inventoryReportQuickLink = {
  title: "Reports",
  href: "/inventory/reports",
  icon: FileSpreadsheet,
} as const;
