"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { navigation } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { env } from "@/utils/env";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navigation;
    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-[11px] font-semibold tracking-wide text-sidebar-primary-foreground shadow-sm">
          ERP
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
              {env.appName}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">23 modules · live API</p>
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
              placeholder="Search modules…"
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
              aria-label="Search modules"
            />
          </div>
        </div>
      ) : null}

      <nav className="erp-scroll flex-1 overflow-y-auto px-2.5 py-2">
        {filtered.map((group) => (
          <div key={group.title} className="mb-5">
            {!collapsed ? (
              <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                      ) : null}
                      {Icon ? (
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                          )}
                        />
                      ) : (
                        <span className="size-4" />
                      )}
                      {!collapsed ? <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span> : null}
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
          variant="ghost"
          size="sm"
          className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1.5 text-xs">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
