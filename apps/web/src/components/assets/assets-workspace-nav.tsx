"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  activeAssetDomainFromPath,
  buildAssetSidebarNav,
  isAssetNavActive,
  type AssetDomainKey,
} from "@/config/assets";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";

/** Horizontal strip when Assets shares the main app sidebar (non-standalone). */
export function AssetsWorkspaceNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { adminModuleKeys, assetsModuleAdmin } = useAuthUser();
  const orgAssetsAdmin = adminModuleKeys.includes("assets") || assetsModuleAdmin;
  const [isModuleAdmin, setIsModuleAdmin] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [adminDomains, setAdminDomains] = useState<string[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);

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

  const items = useMemo(() => {
    const nav = buildAssetSidebarNav({
      isModuleAdmin: accessLoaded ? isModuleAdmin : false,
      domains: accessLoaded ? domains : ["IT"],
      adminDomains: accessLoaded ? adminDomains : [],
      activeDomain: activeDomain ?? "IT",
    });
    return nav.flatMap((group) => group.items);
  }, [accessLoaded, isModuleAdmin, domains, adminDomains, activeDomain]);

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1">
      <nav
        aria-label="Assets workspace"
        className="erp-scroll min-w-0 overflow-x-auto overscroll-x-contain"
        data-testid="assets-workspace-nav"
      >
        <ul className="flex w-max items-center gap-0.5 border-b border-border/70 pb-px">
          {items.map((item) => {
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
            return (
              <li key={`${item.href}-${item.title}`} className="shrink-0">
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
