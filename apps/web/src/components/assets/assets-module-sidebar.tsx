"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  activeAssetDomainFromPath,
  buildAssetSidebarNav,
  isAssetNavActive,
  type AssetDomainKey,
} from "@/config/assets";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";

/**
 * Docked Asset Management sidebar.
 * Top: IT / Non-IT domain switcher. Active domain expands workspace + nested Users.
 */
export function AssetsModuleSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { adminModuleKeys, assetsModuleAdmin } = useAuthUser();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [isModuleAdmin, setIsModuleAdmin] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [adminDomains, setAdminDomains] = useState<string[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);

  const orgAssetsAdmin = adminModuleKeys.includes("assets") || assetsModuleAdmin;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyDomainAccess();
        if (!cancelled) {
          setIsModuleAdmin(me.is_module_admin || orgAssetsAdmin);
          setDomains(me.domains ?? []);
          setAdminDomains(me.admin_domains ?? []);
        }
      } catch {
        if (!cancelled) {
          setIsModuleAdmin(orgAssetsAdmin);
          setDomains(orgAssetsAdmin ? ["IT", "NON_IT"] : []);
          setAdminDomains(orgAssetsAdmin ? ["IT", "NON_IT"] : []);
        }
      } finally {
        if (!cancelled) setAccessLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgAssetsAdmin]);

  const activeDomain: AssetDomainKey | null = useMemo(() => {
    if (pathname.startsWith("/assets/users")) {
      const q = (searchParams.get("domain") || "").toUpperCase();
      if (q === "IT" || q === "NON_IT") return q;
      return "IT";
    }
    return activeAssetDomainFromPath(pathname);
  }, [pathname, searchParams]);

  const gatedNav = useMemo(() => {
    if (!accessLoaded) {
      return buildAssetSidebarNav({
        isModuleAdmin: false,
        domains: ["IT"],
        adminDomains: [],
        activeDomain: activeDomain ?? "IT",
      });
    }
    return buildAssetSidebarNav({
      isModuleAdmin,
      domains,
      adminDomains,
      activeDomain,
    });
  }, [accessLoaded, isModuleAdmin, domains, adminDomains, activeDomain]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gatedNav;
    return gatedNav
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, gatedNav]);

  return (
    <aside
      aria-label="Asset Management"
      data-testid="assets-module-sidebar"
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/10">
          <Package className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              Asset Management
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">IT · Non-IT</p>
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
              placeholder="Search Assets…"
              className="h-9 rounded-xl border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-sidebar-primary/60 transition-all duration-150"
              aria-label="Search Asset Management panes"
            />
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Asset Management"
        className="erp-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2"
        data-testid="assets-module-sidebar-nav"
      >
        {filtered.map((group, gi) => (
          <div key={group.title ?? gi} className="mb-3">
            {group.title && !collapsed ? (
              <p className="mb-2 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.title}
              </p>
            ) : null}
            {group.title && collapsed ? (
              <div className="mx-auto mb-1.5 h-px w-6 bg-sidebar-border" aria-hidden />
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                let active = isAssetNavActive(pathname, item.href, item.match ?? "prefix");
                if (item.href === "/assets" && item.title === "IT Assets") {
                  active = activeDomain === "IT";
                } else if (item.href === "/assets/non-it" && item.title === "Non-IT Assets") {
                  active = activeDomain === "NON_IT";
                } else if (item.href.startsWith("/assets/users")) {
                  active =
                    pathname.startsWith("/assets/users") &&
                    (searchParams.get("domain") || "IT").toUpperCase() ===
                      (item.href.includes("NON_IT") ? "NON_IT" : "IT");
                }
                const Icon = item.icon;
                return (
                  <li key={`${item.href}-${item.title}`}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      aria-label={item.title}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex cursor-pointer items-center rounded-xl text-[13px] font-medium",
                        "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985]",
                        collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-2.5 py-2",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-white/10 backdrop-blur-xs"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-2 left-0.5 w-1 rounded-full bg-sidebar-primary shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-150 group-hover:scale-105",
                          active
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                        )}
                        aria-hidden
                      />
                      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.title}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand Asset Management sidebar" : "Collapse Asset Management sidebar"}
          data-testid="assets-module-sidebar-collapse"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
