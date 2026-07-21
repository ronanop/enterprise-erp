"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary ecommerce screens from FRD-22 / ERD_22 */
const ECOMMERCE_NAV = [
  { title: "Overview", href: "/ecommerce" },
  { title: "Stores", href: "/ecommerce/stores" },
  { title: "Listings", href: "/ecommerce/product-listings" },
  { title: "Carts", href: "/ecommerce/customer-carts" },
  { title: "Orders", href: "/ecommerce/orders" },
  { title: "Payments", href: "/ecommerce/payments" },
  { title: "Shipments", href: "/ecommerce/shipments" },
  { title: "Returns", href: "/ecommerce/return-requests" },
] as const;

export function EcommerceWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ecommerce workspace"
      className="erp-scroll -mx-1 overflow-x-auto px-1"
    >
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {ECOMMERCE_NAV.map((item) => {
          const active =
            item.href === "/ecommerce"
              ? pathname === "/ecommerce"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
