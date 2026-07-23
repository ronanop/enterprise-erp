"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Handshake, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCrmSidebarFocus,
  isCompanyDealWorkspacePath,
  setCrmOpportunityContext,
  setCrmSidebarFocus,
  type CrmSidebarFocus,
} from "@/lib/crm-sidebar-focus";
import { cn } from "@/lib/utils";

/** Sales CRM (Zoho-replacement) teamspace navigation. */
export const CRM_NAV = [
  { title: "Dashboard", href: "/crm" },
  { title: "My Jobs", href: "/crm/my-jobs" },
  { title: "Company", href: "/crm/companies" },
  { title: "Leads", href: "/crm/leads" },
  { title: "Opportunities", href: "/crm/opportunities" },
  { title: "OEM Quote", href: "/crm/oem-quotes" },
  { title: "Quotes", href: "/crm/quotes" },
  { title: "Purchase Order", href: "/crm/purchase-orders" },
  { title: "OVF", href: "/crm/ovf" },
  { title: "Contacts", href: "/crm/contacts" },
  { title: "Products", href: "/crm/products" },
  { title: "Meetings", href: "/crm/meetings" },
  { title: "Customer Follow Ups", href: "/crm/customer-followups" },
  { title: "KYC - Account Mapping", href: "/crm/kyc-account-mapping" },
  { title: "OEM", href: "/crm/oem" },
  { title: "Distributor", href: "/crm/distributors" },
  { title: "BOQ", href: "/crm/boq" },
  { title: "SOW", href: "/crm/sow" },
  { title: "Entity", href: "/crm/entities" },
  { title: "End Customer", href: "/crm/end-customers" },
] as const;

function focusForHref(href: string): CrmSidebarFocus | null {
  if (href === "/crm") return "dashboard";
  if (href === "/crm/companies") return "company";
  if (href === "/crm/leads") return "leads";
  if (href === "/crm/opportunities") return "opportunities";
  return null;
}

function isCrmNavActive(pathname: string, href: string): boolean {
  const focus = getCrmSidebarFocus();

  // Dashboard is exact-match only — `/crm` must not light up for every CRM child route.
  if (href === "/crm") {
    return pathname === "/crm";
  }

  // Company list / overview only — not company section routes (quotes, PO, …).
  if (href === "/crm/companies") {
    if (focus === "opportunities" && isCompanyDealWorkspacePath(pathname)) {
      return false;
    }
    if (pathname === "/crm/companies" || pathname === "/crm/companies/") return true;
    // Company account overview: /crm/companies/{uuid} with no further segment.
    return /^\/crm\/companies\/[^/]+\/?$/.test(pathname) && focus !== "opportunities";
  }

  // Keep Opportunities highlighted while browsing deal docs under a company from an opportunity.
  if (href === "/crm/opportunities") {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (pathname.includes("/quotes") || pathname.includes("/ovf")) return false;
      return true;
    }
    if (focus === "opportunities" && isCompanyDealWorkspacePath(pathname)) {
      return true;
    }
    return false;
  }

  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return true;
  }
  if (href === "/crm/quotes" && pathname.includes("/quotes")) return true;
  if (href === "/crm/ovf" && pathname.includes("/ovf")) return true;
  return false;
}

/** Horizontal tab strip (used when CRM shares the main app sidebar). */
export function CrmWorkspaceNav() {
  const pathname = usePathname();

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="CRM workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {CRM_NAV.map((item) => {
            const active = isCrmNavActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
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
    </div>
  );
}

/** Left sidebar chrome for standalone CRM tabs (replaces AppSidebar). */
export function CrmSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CRM_NAV;
    return CRM_NAV.filter((item) => item.title.toLowerCase().includes(q));
  }, [query]);

  return (
    <aside
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Handshake className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
              Sales CRM
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">
              {CRM_NAV.length} workspace panes
            </p>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CRM…"
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
              aria-label="Search CRM panes"
            />
          </div>
        </div>
      ) : null}

      <nav aria-label="CRM workspace" className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {!collapsed ? (
          <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {filtered.map((item) => {
            const active = isCrmNavActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.title}
                  onClick={() => {
                    const focus = focusForHref(item.href);
                    if (focus) setCrmSidebarFocus(focus);
                    if (focus !== "opportunities") setCrmOpportunityContext(null);
                  }}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                  ) : null}
                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  ) : (
                    <span className="text-[10px] font-semibold tracking-wide">
                      {item.title.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand CRM sidebar" : "Collapse CRM sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
