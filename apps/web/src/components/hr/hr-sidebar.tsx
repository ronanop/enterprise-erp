"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import {
  ModuleSidebar,
  type ModuleNavGroup,
  type ModuleNavItem,
} from "@/components/layout/module-sidebar";
import { flattenHrNavHrefs, hrNavGroups, type HrNavGroup, type HrNavItem } from "@/config/hr-nav";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { getMyHrNavAccess } from "@/services/hr-superadmin-service";

function navHrefMatches(pathname: string, search: string, href: string): boolean {
  const [pathPart, queryPart] = href.split("?");
  if (pathPart === "/hr") return pathname === "/hr" && !queryPart;
  if (pathPart === "/hr/ess") {
    return pathname === "/hr/ess" || pathname.startsWith("/hr/ess-inbox");
  }
  if (pathPart === "/hr/time") return pathname === "/hr/time";
  if (pathname.startsWith("/hr/payroll/salary-structures")) {
    return href === "/hr/payroll?section=salary-structure";
  }
  if (pathname.startsWith("/hr/payroll/runs")) {
    return href === "/hr/payroll?section=run-payroll";
  }
  const pathOk = pathname === pathPart || pathname.startsWith(`${pathPart}/`);
  if (!pathOk) return false;
  if (!queryPart) {
    // Parent /hr/setup matches any setup path; children with ?section= are more specific
    return true;
  }
  const want = new URLSearchParams(queryPart);
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}

function resolveActiveHref(pathname: string, search: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((href) => navHrefMatches(pathname, search, href));
  if (!matches.length) return null;
  // Prefer longer / more specific (query string counts)
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

type NavAccess = { unrestricted: boolean; keys: Set<string> };

function visibleNavGroups(isHrmsSuperAdmin: boolean, access: NavAccess | null): HrNavGroup[] {
  const unrestricted = isHrmsSuperAdmin || access == null || access.unrestricted;
  const allowed = access?.keys ?? new Set<string>();
  return hrNavGroups.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => isHrmsSuperAdmin || !item.superAdminOnly)
      .map((item) => {
        if (unrestricted || item.superAdminOnly) return item;
        if (item.children?.length) {
          const children = item.children.filter((child) => child.navKey && allowed.has(child.navKey));
          return { ...item, children };
        }
        return item;
      })
      .filter((item) => {
        if (item.superAdminOnly) return isHrmsSuperAdmin;
        if (unrestricted) return true;
        if (item.children?.length) return item.children.length > 0;
        return Boolean(item.navKey && allowed.has(item.navKey));
      }),
  }));
}

function toModuleNavItem(item: HrNavItem): ModuleNavItem {
  return {
    title: item.title,
    href: item.href,
    icon: item.icon,
    keywords: item.description,
    children: item.children?.map(toModuleNavItem),
  };
}

/** Left sidebar for HRMS routes (`/hr`), on the shared enterprise rail. */
export function HrSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { isHrmsSuperAdmin } = useUserPermissions();
  const [navAccess, setNavAccess] = useState<NavAccess | null>(
    isHrmsSuperAdmin ? { unrestricted: true, keys: new Set() } : null,
  );

  useEffect(() => {
    if (isHrmsSuperAdmin) {
      setNavAccess({ unrestricted: true, keys: new Set() });
      return;
    }
    let cancelled = false;
    void getMyHrNavAccess()
      .then((row) => {
        if (cancelled) return;
        setNavAccess({ unrestricted: row.unrestricted, keys: new Set(row.nav_keys) });
      })
      .catch(() => {
        if (!cancelled) setNavAccess({ unrestricted: true, keys: new Set() });
      });
    return () => {
      cancelled = true;
    };
  }, [isHrmsSuperAdmin]);

  const hrGroups = useMemo(
    () => visibleNavGroups(isHrmsSuperAdmin, navAccess),
    [isHrmsSuperAdmin, navAccess],
  );
  const groups = useMemo<ModuleNavGroup[]>(
    () =>
      hrGroups.map((group) => ({
        label: group.label || undefined,
        items: group.items.map(toModuleNavItem),
      })),
    [hrGroups],
  );
  const activeHref = useMemo(
    () => resolveActiveHref(pathname, search, flattenHrNavHrefs(hrGroups)),
    [pathname, search, hrGroups],
  );

  return (
    <ModuleSidebar
      moduleKey="hr"
      title="HRMS"
      subtitle="Workforce · Leave · Pay"
      icon={Users}
      aria-label="HR workspace"
      groups={groups}
      isActive={(item) => item.href === activeHref}
    />
  );
}
