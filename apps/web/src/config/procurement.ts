/**
 * Procurement workspace config — SCM OVF → PO → GRN → Invoice flow.
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type ProcurementWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type ProcurementPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource: "scm" | "orders" | "grns";
};

export const PROCUREMENT_MODULE_KEY = "procurement";

export const procurementWorkspaceGroups: ProcurementWorkspaceGroup[] = [
  {
    key: "scm",
    title: "SCM Workflow",
    description: "OVF queue, vendor POs, and goods receipt",
    icon: Truck,
    resourceKeys: ["scm", "orders", "grns", "delivery-challan", "delivery-status", "inventory"],
  },
  {
    key: "fulfillment",
    title: "Fulfillment & Payables",
    description: "Vendor master",
    icon: ShoppingCart,
    resourceKeys: ["vendors"],
  },
];

/** Current SCM lifecycle: approved OVF → PO → GRN */
export const procurementPipelineStages: ProcurementPipelineStage[] = [
  { key: "scm", title: "SCM Queue", href: "/procurement/scm", resource: "scm" },
  { key: "order", title: "Purchase Order", href: "/procurement/orders", resource: "orders" },
  { key: "grn", title: "GRN", href: "/procurement/grns", resource: "grns" },
];

export function getProcurementResources(): ModuleResource[] {
  return getModule(PROCUREMENT_MODULE_KEY)?.resources ?? [];
}

export function resolveProcurementGroupResources(
  group: ProcurementWorkspaceGroup,
): ModuleResource[] {
  const all = getProcurementResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const procurementQuickLinks = [
  {
    title: "SCM Queue",
    href: "/procurement/scm",
    description: "Approved OVFs → Create PO",
    icon: ClipboardList,
  },
  {
    title: "Purchase Orders",
    href: "/procurement/orders",
    description: "Draft, issued, and GRN status",
    icon: ShoppingCart,
  },
  {
    title: "GRNs",
    href: "/procurement/grns",
    description: "Goods receipts",
    icon: PackageCheck,
  },
  {
    title: "Vendors",
    href: "/procurement/vendors",
    description: "Vendor master list",
    icon: Receipt,
  },
] as const;
