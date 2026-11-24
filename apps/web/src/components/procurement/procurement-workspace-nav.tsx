"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, type ComponentType } from "react";
import {
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  History,
  Hourglass,
  LayoutDashboard,
  MapPinned,
  Mail,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
  UserCog,
  Wrench,
} from "lucide-react";

import { ModuleSidebar, type ModuleNavItem } from "@/components/layout/module-sidebar";
import { canManageModuleUsers } from "@/lib/module-access";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useProcurementApprovalAccess } from "@/hooks/use-procurement-approval-access";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import { useScmQueueUnreadCount } from "@/hooks/use-scm-queue-unread-count";
import { prefetchProcurementTab } from "@/services/procurement-service";
import { useDeliveryReminderSweep } from "@/hooks/use-delivery-reminder-sweep";

type NavIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type ProcurementNavItem = {
  title: string;
  href: string;
  icon: NavIcon;
};

export const PROCUREMENT_NAV = [
  { title: "Dashboard", href: "/procurement", icon: LayoutDashboard },
  { title: "SCM Queue", href: "/procurement/scm", icon: ClipboardList },
  { title: "Purchase Orders", href: "/procurement/orders", icon: ShoppingCart },
  { title: "GRNs", href: "/procurement/grns", icon: PackageCheck },
  { title: "Billing/DC", href: "/procurement/delivery-challan", icon: Truck },
  { title: "Delivery Status", href: "/procurement/delivery-status", icon: MapPinned },
  { title: "Tracker Upload", href: "/procurement/tracker", icon: FileSpreadsheet },
  { title: "Installation", href: "/procurement/installation", icon: Wrench },
  { title: "Vendors", href: "/procurement/vendors", icon: Building2 },
  { title: "Inventory", href: "/procurement/inventory", icon: Boxes },
  { title: "Stock Aging", href: "/procurement/inventory-aging", icon: Hourglass },
  { title: "Approval", href: "/procurement/approval", icon: BadgeCheck },
] as const satisfies ReadonlyArray<ProcurementNavItem>;

export const PROCUREMENT_INSIGHT_NAV = [
  { title: "Mails", href: "/procurement/correspondence", icon: Mail },
  { title: "Reports", href: "/procurement/reports", icon: FileBarChart },
  { title: "Timeline", href: "/procurement/timeline", icon: History },
] as const satisfies ReadonlyArray<ProcurementNavItem>;

/** ERP / procurement module admin only (Insight + Tracker Upload). */
export const PROCUREMENT_ADMIN_ONLY_HREFS = new Set([
  "/procurement/tracker",
  ...PROCUREMENT_INSIGHT_NAV.map((item) => item.href),
]);

export const ALL_PROCUREMENT_NAV = [
  ...PROCUREMENT_NAV,
  ...PROCUREMENT_INSIGHT_NAV,
] as const;

export function warmProcurementNavTarget(
  router: ReturnType<typeof useRouter>,
  href: string,
): void {
  router.prefetch(href);
  prefetchProcurementTab(href);
}

export function warmAllProcurementNavTargets(router: ReturnType<typeof useRouter>): void {
  for (const item of ALL_PROCUREMENT_NAV) {
    warmProcurementNavTarget(router, item.href);
  }
  warmProcurementNavTarget(router, "/procurement/users");
}

function isProcurementNavActive(
  pathname: string,
  href: string,
  searchParams?: { get: (key: string) => string | null } | null,
): boolean {
  if (href === "/procurement") {
    return pathname === "/procurement";
  }

  // GRN workspace lives under /procurement/orders/[id]?tab=grn — keep GRNs lit.
  const onOrderDetail = pathname.startsWith("/procurement/orders/");
  const inGrnWorkspace =
    onOrderDetail &&
    (searchParams?.get("tab") === "grn" || searchParams?.get("from") === "grns");

  if (href === "/procurement/grns") {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    return Boolean(inGrnWorkspace);
  }

  if (href === "/procurement/orders") {
    if (inGrnWorkspace) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left sidebar for the Procurement workspace. */
export function ProcurementSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, adminModuleKeys } = useAuthUser();
  const { isAdmin } = useProcurementRole();
  const { canDecideApprovals } = useProcurementApprovalAccess();
  const { pendingCount } = useProcurementApprovals();
  const scmUnreadCount = useScmQueueUnreadCount();
  useDeliveryReminderSweep();

  const workspaceItems = useMemo(() => {
    const items: ModuleNavItem[] = PROCUREMENT_NAV.filter(
      (item) => isAdmin || !PROCUREMENT_ADMIN_ONLY_HREFS.has(item.href),
    ).map((item) => ({
      ...item,
      badge:
        item.href === "/procurement/approval" && canDecideApprovals
          ? pendingCount
          : item.href === "/procurement/scm"
            ? scmUnreadCount
            : undefined,
    }));
    if (canManageModuleUsers("procurement", adminModuleKeys, user?.userType)) {
      items.push({ title: "Users", href: "/procurement/users", icon: UserCog });
    }
    return items;
  }, [
    adminModuleKeys,
    canDecideApprovals,
    isAdmin,
    pendingCount,
    scmUnreadCount,
    user?.userType,
  ]);

  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => warmAllProcurementNavTargets(router), {
        timeout: 2000,
      });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => warmAllProcurementNavTargets(router), 100);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const active =
      workspaceItems.find((item) =>
        isProcurementNavActive(pathname, item.href, searchParams),
      ) ??
      ALL_PROCUREMENT_NAV.find((item) =>
        isProcurementNavActive(pathname, item.href, searchParams),
      ) ??
      PROCUREMENT_NAV[0];
    warmProcurementNavTarget(router, active.href);
  }, [workspaceItems, pathname, searchParams, router]);

  const groups = useMemo(() => {
    const next: { label: string; items: ModuleNavItem[] }[] = [
      { label: "Workspace", items: workspaceItems },
    ];
    if (isAdmin) {
      next.push({
        label: "Insight",
        items: PROCUREMENT_INSIGHT_NAV.map((item) => ({ ...item })),
      });
    }
    return next;
  }, [isAdmin, workspaceItems]);

  return (
    <ModuleSidebar
      moduleKey="procurement"
      title="Procurement"
      subtitle={isAdmin ? "Admin workspace" : "SCM workspace"}
      icon={Package}
      aria-label="Procurement workspace"
      groups={groups}
      isActive={(item) => isProcurementNavActive(pathname, item.href, searchParams)}
      onItemWarm={(item) => warmProcurementNavTarget(router, item.href)}
    />
  );
}
