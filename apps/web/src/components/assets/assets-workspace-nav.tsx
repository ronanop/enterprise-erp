"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { assetManagementNav, isAssetNavActive } from "@/config/assets";
import { cn } from "@/lib/utils";

/** Horizontal strip when Assets shares the main app sidebar (non-standalone). */
export function AssetsWorkspaceNav() {
  const pathname = usePathname();
  const items = assetManagementNav.flatMap((group) => group.items);

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Assets workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
        data-testid="assets-workspace-nav"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {items.map((item) => {
            const active = isAssetNavActive(pathname, item.href, item.match ?? "prefix");
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium transition-[color,background-color] duration-200",
                    active
                      ? "bg-muted/60 font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
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
