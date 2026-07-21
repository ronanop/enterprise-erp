/**
 * Sales workspace config — aligned with FRD-06 screen inventory
 * and apps/api sales routers (quote → order → delivery → invoice → return).
 */

import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Receipt,
  ShoppingCart,
  Tag,
  Truck,
  WalletCards,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type SalesWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type SalesPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource: "quotations" | "orders" | "deliveries" | "invoices" | "returns";
};

export const SALES_MODULE_KEY = "sales";

export const salesWorkspaceGroups: SalesWorkspaceGroup[] = [
  {
    key: "commercial",
    title: "Commercial Documents",
    description: "Quotations through invoices — order-to-cash flow",
    icon: ShoppingCart,
    resourceKeys: ["quotations", "orders", "deliveries", "invoices", "returns"],
  },
  {
    key: "pricing",
    title: "Pricing & Discounts",
    description: "Price lists and discount rules",
    icon: Tag,
    resourceKeys: ["price-lists", "discount-rules"],
  },
  {
    key: "credit",
    title: "Customer Credit",
    description: "Credit limits, usage, and holds",
    icon: WalletCards,
    resourceKeys: ["customer-credit"],
  },
];

/** FRD-06 sales lifecycle (operational stages available in this module) */
export const salesPipelineStages: SalesPipelineStage[] = [
  { key: "quotation", title: "Quotation", href: "/sales/quotations", resource: "quotations" },
  { key: "order", title: "Sales Order", href: "/sales/orders", resource: "orders" },
  { key: "delivery", title: "Delivery", href: "/sales/deliveries", resource: "deliveries" },
  { key: "invoice", title: "Invoice", href: "/sales/invoices", resource: "invoices" },
  { key: "return", title: "Return", href: "/sales/returns", resource: "returns" },
];

export function getSalesResources(): ModuleResource[] {
  return getModule(SALES_MODULE_KEY)?.resources ?? [];
}

export function resolveSalesGroupResources(group: SalesWorkspaceGroup): ModuleResource[] {
  const all = getSalesResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const salesQuickLinks = [
  {
    title: "Quotations",
    href: "/sales/quotations",
    description: "Customer proposals",
    icon: FileText,
  },
  {
    title: "Sales Orders",
    href: "/sales/orders",
    description: "Confirmed demand",
    icon: ShoppingCart,
  },
  {
    title: "Deliveries",
    href: "/sales/deliveries",
    description: "Outbound shipments",
    icon: Truck,
  },
  {
    title: "Invoices",
    href: "/sales/invoices",
    description: "Billing & AR posting",
    icon: Receipt,
  },
] as const;
