"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetManagementNav, isAssetNavActive } from "@/config/assets";
import { cn } from "@/lib/utils";

/**
 * Docked Asset Management sidebar for standalone module tabs.
 * Replaces AppSidebar — in-flow, opaque, collapse via toggle (never overlays content).
 */
export function AssetsModuleSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assetManagementNav;
    return assetManagementNav
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <aside
      aria-label="Asset Management"
      data-testid="assets-module-sidebar"
      data-erp-primary-sidebar
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Package className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
              Asset Management
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">Inventory · operations</p>
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
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
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
              <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.title}
              </p>
            ) : null}
            {group.title && collapsed ? (
              <div className="mx-auto mb-1.5 h-px w-6 bg-sidebar-border" aria-hidden />
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isAssetNavActive(pathname, item.href, item.match ?? "prefix");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      aria-label={item.title}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex cursor-pointer items-center rounded-lg text-[13px] font-medium",
                        "transition-colors duration-200 motion-reduce:transition-none",
                        collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-2.5 py-2",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
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
