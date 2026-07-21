"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Sales CRM (Zoho-replacement) teamspace navigation. */
const CRM_NAV = [
  { title: "My Jobs", href: "/crm/my-jobs" },
  { title: "Company", href: "/crm/companies" },
  { title: "Leads", href: "/crm/leads" },
  { title: "Opportunities", href: "/crm/opportunities" },
  { title: "Quotes", href: "/crm/quotes" },
  { title: "OVF", href: "/crm/ovf" },
  { title: "Contacts", href: "/crm/contacts" },
  { title: "Products", href: "/crm/products" },
  { title: "Calls", href: "/crm/calls" },
  { title: "KYC", href: "/crm/kyc" },
] as const;

export function CrmWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="CRM workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {CRM_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
