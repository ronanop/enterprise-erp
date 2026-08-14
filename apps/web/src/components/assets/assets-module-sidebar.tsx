"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { assetManagementNav } from "@/config/assets";
import { cn } from "@/lib/utils";

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "prefix",
): boolean {
  if (href === "/assets") {
    return pathname === "/assets";
  }
  if (match === "exact") {
    return pathname === href;
  }
  if (pathname === href) return true;
  if (href === "/assets/assets" && pathname.startsWith("/assets/assets/new")) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}

export function AssetsModuleSidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Asset Management"
      data-testid="assets-module-sidebar"
      className="w-full shrink-0 lg:sticky lg:top-4 lg:w-16 lg:self-start"
    >
      {/* Mobile / small screens: full labels */}
      <nav
        className={cn(
          "rounded-xl border border-border/60 bg-card p-2.5 shadow-sm",
          "lg:hidden",
        )}
        data-testid="assets-module-sidebar-mobile"
      >
        <SidebarNav pathname={pathname} mode="mobile" />
      </nav>

      {/* Desktop: icon rail overlays labels on hover / focus-within (no content push) */}
      <div className="relative hidden lg:block" data-testid="assets-module-sidebar-rail">
        <div className="pointer-events-none invisible w-16 p-2" aria-hidden>
          <SidebarNav pathname={pathname} mode="rail" forceCollapsed />
        </div>
        <nav
          className={cn(
            "group/rail absolute top-0 left-0 z-20 overflow-hidden rounded-xl border border-border/60 bg-card",
            "w-16 hover:w-64 focus-within:w-64",
            "max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain",
            "shadow-sm hover:shadow-lg focus-within:shadow-lg",
            "transition-[width,box-shadow] duration-200 ease-out",
            "motion-reduce:transition-none",
          )}
          data-testid="assets-module-sidebar-rail-nav"
        >
          <div className="p-2">
            <SidebarNav pathname={pathname} mode="rail" />
          </div>
        </nav>
      </div>
    </aside>
  );
}

function SidebarNav({
  pathname,
  mode,
  forceCollapsed = false,
}: {
  pathname: string;
  mode: "mobile" | "rail";
  forceCollapsed?: boolean;
}) {
  const rail = mode === "rail";
  const expandLabel = rail && !forceCollapsed;

  return (
    <div className="space-y-4">
      {assetManagementNav.map((group, gi) => (
        <div key={gi}>
          {group.title ? (
            rail ? (
              <>
                {expandLabel ? (
                  <p
                    className={cn(
                      "mb-1.5 overflow-hidden px-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase",
                      "max-w-0 opacity-0 whitespace-nowrap",
                      "group-hover/rail:max-w-[14rem] group-hover/rail:opacity-100",
                      "group-focus-within/rail:max-w-[14rem] group-focus-within/rail:opacity-100",
                      "transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none",
                    )}
                  >
                    {group.title}
                  </p>
                ) : null}
                <div
                  className={cn(
                    "mx-auto mb-1.5 h-px w-6 bg-border",
                    expandLabel && "group-hover/rail:hidden group-focus-within/rail:hidden",
                  )}
                  aria-hidden
                />
              </>
            ) : (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {group.title}
              </p>
            )
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.match ?? "prefix");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.title}
                    aria-label={item.title}
                    aria-current={active ? "page" : undefined}
                    tabIndex={forceCollapsed ? -1 : undefined}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg text-sm font-medium",
                      "transition-colors duration-200",
                      rail
                        ? cn(
                            "h-10 justify-center gap-0 px-0",
                            expandLabel &&
                              "group-hover/rail:justify-start group-hover/rail:gap-3 group-hover/rail:px-2.5 group-focus-within/rail:justify-start group-focus-within/rail:gap-3 group-focus-within/rail:px-2.5",
                          )
                        : "h-10 gap-3 px-2.5",
                      active
                        ? "bg-primary/10 text-foreground shadow-[inset_0_0_0_1px] shadow-primary/15"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active ? "text-primary opacity-100" : "opacity-90",
                      )}
                      aria-hidden
                    />
                    {rail ? (
                      expandLabel ? (
                        <span
                          className={cn(
                            "truncate overflow-hidden whitespace-nowrap",
                            "max-w-0 opacity-0",
                            "group-hover/rail:max-w-[13rem] group-hover/rail:opacity-100",
                            "group-focus-within/rail:max-w-[13rem] group-focus-within/rail:opacity-100",
                            "transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none",
                          )}
                        >
                          {item.title}
                        </span>
                      ) : null
                    ) : (
                      <span className="truncate">{item.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
