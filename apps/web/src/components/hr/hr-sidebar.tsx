"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Search } from "lucide-react";

import { flattenHrNavHrefs, hrNavGroups, type HrNavGroup, type HrNavItem } from "@/config/hr-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { clearTokens } from "@/lib/auth";
import { authService } from "@/services/api-client";
import { cn } from "@/lib/utils";

function navHrefMatches(pathname: string, search: string, href: string): boolean {
  const [pathPart, queryPart] = href.split("?");
  if (pathPart === "/hr") return pathname === "/hr" && !queryPart;
  if (pathPart === "/hr/ess") {
    return pathname === "/hr/ess" || pathname.startsWith("/hr/ess-inbox");
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

function itemMatchesQuery(item: HrNavItem, q: string): boolean {
  if (
    item.title.toLowerCase().includes(q) ||
    item.description?.toLowerCase().includes(q)
  ) {
    return true;
  }
  return (item.children ?? []).some((c) => itemMatchesQuery(c, q));
}

function NavLinkRow({
  item,
  activeHref,
  collapsed,
  nested,
  forceActive,
}: {
  item: HrNavItem;
  activeHref: string | null;
  collapsed: boolean;
  nested?: boolean;
  forceActive?: boolean;
}) {
  const Icon = item.icon;
  const active = Boolean(forceActive) || item.href === activeHref;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
        nested && "py-1.5 pl-9 text-[13px]",
        active
          ? "bg-[#9B5BB8] text-white"
          : "text-[#AEB6C3] hover:bg-[#2A2A2A] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          nested && "size-3.5",
          active
            ? "text-white"
            : "text-white group-hover:text-white",
        )}
      />
      {!collapsed ? <span className="truncate font-medium">{item.title}</span> : null}
    </Link>
  );
}

function visibleNavGroups(isHrmsSuperAdmin: boolean): HrNavGroup[] {
  return hrNavGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => isHrmsSuperAdmin || !item.superAdminOnly),
  }));
}

function SidebarNavBody({
  collapsed,
  query,
}: {
  collapsed: boolean;
  query: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { isHrmsSuperAdmin } = useUserPermissions();
  const groups = useMemo(() => visibleNavGroups(isHrmsSuperAdmin), [isHrmsSuperAdmin]);

  const allNavHrefs = useMemo(() => flattenHrNavHrefs(groups), [groups]);
  const activeHref = useMemo(
    () => resolveActiveHref(pathname, search, allNavHrefs),
    [pathname, search, allNavHrefs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items
          .filter((item) => itemMatchesQuery(item, q))
          .map((item) => {
            if (!item.children?.length) return item;
            const kids = item.children.filter((c) => itemMatchesQuery(c, q));
            return kids.length ? { ...item, children: kids } : item;
          }),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, groups]);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    for (const g of groups) {
      for (const item of g.items) {
        if (!item.children?.length) continue;
        const childActive = item.children.some((c) =>
          navHrefMatches(pathname, search, c.href),
        );
        const parentActive = navHrefMatches(pathname, search, item.href);
        if (childActive || parentActive) {
          setOpenMenus((prev) => ({ ...prev, [item.href]: true }));
        }
      }
    }
  }, [pathname, search, groups]);

  return (
    <nav className="erp-scroll flex-1 space-y-1 overflow-y-auto bg-[#0A0A0A] px-2 pb-3">
      {filtered.map((group) => (
        <div key={group.label || "main"}>
          {!collapsed && group.label ? (
            <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-[#AEB6C3] uppercase">
              {group.label}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const hasChildren = Boolean(item.children?.length) && !collapsed;
              const expanded = openMenus[item.href] ?? false;
              const childActive = (item.children ?? []).some((c) => c.href === activeHref);
              const parentExactActive = item.href === activeHref;

              if (!hasChildren) {
                return (
                  <li key={item.href}>
                    <NavLinkRow
                      item={item}
                      activeHref={activeHref}
                      collapsed={collapsed}
                      forceActive={collapsed && childActive}
                    />
                  </li>
                );
              }

              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    className={cn(
                      "group relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-all duration-200",
                      parentExactActive
                        ? "bg-[#9B5BB8] text-white"
                        : "text-[#AEB6C3] hover:bg-[#2A2A2A] hover:text-white",
                    )}
                    onClick={() =>
                      setOpenMenus((prev) => ({ ...prev, [item.href]: !expanded }))
                    }
                    aria-expanded={expanded}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        parentExactActive
                          ? "text-white"
                          : "text-white group-hover:text-white",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 transition-transform duration-200",
                        parentExactActive ? "text-white/80" : "text-[#AEB6C3]",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded ? (
                    <ul className="mt-0.5 space-y-0.5">
                      {item.children!.map((child) => (
                        <li key={child.href}>
                          <NavLinkRow
                            item={child}
                            activeHref={activeHref}
                            collapsed={false}
                            nested
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** CACHE Digitech lettermark — open C with center dot. */
function CacheMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle
        cx="20"
        cy="20"
        r="14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="76 24"
        transform="rotate(-40 20 20)"
      />
      <circle cx="20" cy="20" r="4.25" fill="currentColor" />
    </svg>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/hr"
      title="CACHE"
      className={cn(
        "flex items-center rounded-xl outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#9B5BB8]",
        collapsed ? "justify-center p-1" : "px-0.5 py-1",
      )}
    >
      {collapsed ? (
        <span className="flex size-9 items-center justify-center text-[#E31C24]">
          <CacheMark className="size-full" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/cache-wordmark.png?v=3"
          alt="CACHE"
          className="block h-[52px] w-auto max-w-full object-contain object-left mix-blend-screen"
        />
      )}
    </Link>
  );
}

/** Persistent HRMS-only sidebar (swapped in while on /hr routes). */
export function HrSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      clearTokens();
    }
    window.location.assign("/login");
  }

  return (
    <aside
      data-slot="app-sidebar"
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-[#222222] bg-[#0A0A0A] text-white transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("bg-[#0A0A0A]", collapsed ? "p-2" : "px-3 pt-3 pb-2")}>
        <SidebarBrand collapsed={collapsed} />
      </div>

      {!collapsed ? (
        <div className="bg-[#0A0A0A] px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#AEB6C3]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search HR…"
              className="h-9 rounded-xl border-[#222222] bg-[#2A2A2A] pl-8 text-white placeholder:text-[#AEB6C3] focus-visible:ring-[#9B5BB8]"
            />
          </div>
        </div>
      ) : null}

      <Suspense fallback={<div className="flex-1 bg-[#0A0A0A]" />}>
        <div className="flex min-h-0 flex-1 flex-col bg-[#0A0A0A]">
          <SidebarNavBody collapsed={collapsed} query={query} />
        </div>
      </Suspense>

      <div className="space-y-1 border-t border-[#222222] bg-[#0A0A0A] p-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleLogout()}
          className="w-full cursor-pointer justify-center text-[#AEB6C3] hover:bg-[#2A2A2A] hover:text-white"
          aria-label="Sign out"
        >
          <LogOut className="size-4 text-white" />
          {!collapsed ? <span className="ml-1">Sign out</span> : null}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full cursor-pointer justify-center text-[#AEB6C3] hover:bg-[#2A2A2A] hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4 text-white" /> : <ChevronLeft className="size-4 text-white" />}
          {!collapsed ? <span className="ml-1">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
