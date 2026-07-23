/**
 * Procurement workspace config — aligned with FRD-07 screen inventory
 * and apps/api procurement routers (PR → RFQ → PO → GRN → Invoice).
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileSearch,
  PackageCheck,
  Receipt,
  Scale,
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
  resource: "requisitions" | "rfqs" | "orders" | "grns" | "invoices";
};

export const PROCUREMENT_MODULE_KEY = "procurement";

export const procurementWorkspaceGroups: ProcurementWorkspaceGroup[] = [
  {
    key: "scm",
    title: "SCM Workflow",
    description: "OVF queue, vendor POs, and goods receipt",
    icon: Truck,
    resourceKeys: ["scm", "vendor-po", "orders", "grns"],
  },
  {
    key: "sourcing",
    title: "Sourcing",
    description: "Requisitions, RFQs, vendor quotes, and comparisons",
    icon: FileSearch,
    resourceKeys: ["requisitions", "rfqs", "vendor-quotations", "comparisons"],
  },
  {
    key: "fulfillment",
    title: "Fulfillment & Payables",
    description: "Purchase orders, GRNs, vendor invoices, and returns",
    icon: ShoppingCart,
    resourceKeys: ["orders", "grns", "invoices", "returns"],
  },
  {
    key: "vendors",
    title: "Vendor Management",
    description: "Contracts and supplier performance",
    icon: Scale,
    resourceKeys: ["contracts", "performance"],
  },
];

/** FRD-07 procurement lifecycle (core operational stages) */
export const procurementPipelineStages: ProcurementPipelineStage[] = [
  { key: "requisition", title: "Requisition", href: "/procurement/requisitions", resource: "requisitions" },
  { key: "rfq", title: "RFQ", href: "/procurement/rfqs", resource: "rfqs" },
  { key: "order", title: "Purchase Order", href: "/procurement/orders", resource: "orders" },
  { key: "grn", title: "GRN", href: "/procurement/grns", resource: "grns" },
  { key: "invoice", title: "Vendor Invoice", href: "/procurement/invoices", resource: "invoices" },
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
    title: "Vendors & PO",
    href: "/procurement/vendor-po",
    description: "PO list + GRN badges",
    icon: ShoppingCart,
  },
  {
    title: "Purchase Orders",
    href: "/procurement/orders",
    description: "Committed spend",
    icon: PackageCheck,
  },
  {
    title: "GRNs",
    href: "/procurement/grns",
    description: "Goods receipts",
    icon: Receipt,
  },
] as const;
