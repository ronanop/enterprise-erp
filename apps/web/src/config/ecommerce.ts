/**
 * Ecommerce workspace config — aligned with FRD-22 / ERD_22
 * and apps/api ecommerce routers (Listing → Return).
 */

import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Truck,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type EcommerceWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type EcommercePipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "product-listings"
    | "customer-carts"
    | "orders"
    | "payments"
    | "shipments"
    | "return-requests";
};

export const ECOMMERCE_MODULE_KEY = "ecommerce";

export const ecommerceWorkspaceGroups: EcommerceWorkspaceGroup[] = [
  {
    key: "storefront",
    title: "Storefront & Catalog",
    description: "Stores, channels, listings, and marketplace bindings",
    icon: Store,
    resourceKeys: [
      "stores",
      "sales-channels",
      "product-listings",
      "marketplace-connectors",
    ],
  },
  {
    key: "commerce",
    title: "Orders & Fulfillment",
    description: "Carts, orders, payments, and shipments",
    icon: ShoppingBag,
    resourceKeys: ["customer-carts", "orders", "payments", "shipments"],
  },
  {
    key: "merch",
    title: "Returns & Merchandising",
    description: "Returns, coupons, and promotions",
    icon: Tag,
    resourceKeys: ["return-requests", "coupons", "promotions"],
  },
];

/** FRD-22 / ERD_22 channel commerce flow (core operational stages) */
export const ecommercePipelineStages: EcommercePipelineStage[] = [
  {
    key: "listing",
    title: "Listing",
    href: "/ecommerce/product-listings",
    resource: "product-listings",
  },
  {
    key: "cart",
    title: "Cart",
    href: "/ecommerce/customer-carts",
    resource: "customer-carts",
  },
  {
    key: "order",
    title: "Order",
    href: "/ecommerce/orders",
    resource: "orders",
  },
  {
    key: "payment",
    title: "Payment",
    href: "/ecommerce/payments",
    resource: "payments",
  },
  {
    key: "shipment",
    title: "Shipment",
    href: "/ecommerce/shipments",
    resource: "shipments",
  },
  {
    key: "return",
    title: "Return",
    href: "/ecommerce/return-requests",
    resource: "return-requests",
  },
];

export function getEcommerceResources(): ModuleResource[] {
  return getModule(ECOMMERCE_MODULE_KEY)?.resources ?? [];
}

export function resolveEcommerceGroupResources(
  group: EcommerceWorkspaceGroup,
): ModuleResource[] {
  const all = getEcommerceResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const ecommerceQuickLinks = [
  {
    title: "Orders",
    href: "/ecommerce/orders",
    description: "Channel orders",
    icon: ShoppingBag,
  },
  {
    title: "Listings",
    href: "/ecommerce/product-listings",
    description: "Catalog publishing",
    icon: Package,
  },
  {
    title: "Payments",
    href: "/ecommerce/payments",
    description: "Gateway captures",
    icon: CreditCard,
  },
  {
    title: "Shipments",
    href: "/ecommerce/shipments",
    description: "Fulfillment tracking",
    icon: Truck,
  },
] as const;

export const ecommerceIcons = {
  ShoppingCart,
  Store,
} as const;
