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
      className="w-full shrink-0 lg:w-56"
    >
      <nav className="space-y-5 rounded-lg border border-border/70 bg-card p-3">
        {assetManagementNav.map((group, gi) => (
          <div key={gi}>
            {group.title ? (
              <p className="mb-1.5 px-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, item.match ?? "prefix");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200",
                        active
                          ? "bg-primary/10 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
