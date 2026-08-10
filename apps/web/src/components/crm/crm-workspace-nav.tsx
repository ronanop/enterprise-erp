"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Package,
  Receipt,
  ScrollText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Target,
  Truck,
  UserPlus,
  Users,
  UserRound,
} from "lucide-react";

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

type CrmNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

/** Sales CRM (Zoho-replacement) teamspace navigation. */
export const CRM_NAV: readonly CrmNavItem[] = [
  { title: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { title: "My Jobs", href: "/crm/my-jobs", icon: ListTodo },
  { title: "Company", href: "/crm/companies", icon: Building2 },
  { title: "Leads", href: "/crm/leads", icon: UserPlus },
  { title: "Opportunities", href: "/crm/opportunities", icon: Target },
  { title: "OEM Quote", href: "/crm/oem-quotes", icon: FileSpreadsheet },
  { title: "Quotes", href: "/crm/quotes", icon: FileText },
  { title: "Purchase Order", href: "/crm/purchase-orders", icon: ShoppingCart },
  { title: "OVF", href: "/crm/ovf", icon: Receipt },
  { title: "Contacts", href: "/crm/contacts", icon: Users },
  { title: "Products", href: "/crm/products", icon: Package },
  { title: "Meetings", href: "/crm/meetings", icon: CalendarDays },
  { title: "Customer Follow Ups", href: "/crm/customer-followups", icon: BriefcaseBusiness },
  { title: "KYC - Account Mapping", href: "/crm/kyc-account-mapping", icon: ShieldCheck },
  { title: "OEM", href: "/crm/oem", icon: Factory },
  { title: "Distributor", href: "/crm/distributors", icon: Truck },
  { title: "BOQ", href: "/crm/boq", icon: ClipboardList },
  { title: "SOW", href: "/crm/sow", icon: ScrollText },
  { title: "Entity", href: "/crm/entities", icon: Landmark },
  { title: "End Customer", href: "/crm/end-customers", icon: UserRound },
];

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
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
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
            const Icon = item.icon;
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
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors duration-200",
                      active
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                    )}
                    aria-hidden
                  />
                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  ) : (
                    <span className="sr-only">{item.title}</span>
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
