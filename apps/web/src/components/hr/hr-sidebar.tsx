"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { hrNavGroups } from "@/config/hr-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function navHrefMatches(pathname: string, href: string): boolean {
  if (href === "/hr") return pathname === "/hr";
  if (href === "/hr/ess") {
    return pathname === "/hr/ess" || pathname.startsWith("/hr/ess-inbox");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** When several items match (e.g. /hr/time vs /hr/time/biometric-devices), pick the most specific. */
function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((href) => navHrefMatches(pathname, href));
  if (!matches.length) return null;
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Persistent HRMS-only sidebar (swapped in while on /hr routes). */
export function HrSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const allNavHrefs = useMemo(
    () => hrNavGroups.flatMap((group) => group.items.map((item) => item.href)),
    [],
  );

  const activeHref = useMemo(
    () => resolveActiveHref(pathname, allNavHrefs),
    [pathname, allNavHrefs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hrNavGroups;
    return hrNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
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
          HR
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium tracking-tight text-sidebar-foreground">
              HRMS
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">
              People · Time · Talent · Hire
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
              placeholder="Search HR…"
              className="h-9 border-sidebar-border bg-white/5 pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
            />
          </div>
        </div>
      ) : null}

      <nav className="erp-scroll flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {filtered.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-2 px-2.5 text-[10px] font-medium tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200",
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
                          "size-4 shrink-0",
                          active
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                        )}
                      />
                      {!collapsed ? (
                        <span className="truncate font-medium">{item.title}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Back to ERP modules"
        >
          {collapsed ? <ArrowLeft className="size-4" /> : (
            <>
              <ArrowLeft className="size-3.5" />
              All modules
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full cursor-pointer justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span className="ml-1">Collapse</span> : null}
        </Button>
      </div>
    </aside>
  );
}
