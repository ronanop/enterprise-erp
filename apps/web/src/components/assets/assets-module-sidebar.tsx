"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";

import {
  ModuleSidebar,
  type ModuleNavGroup,
  type ModuleNavItem,
} from "@/components/layout/module-sidebar";
import {
  activeAssetDomainFromPath,
  buildAssetSidebarNav,
  isAssetNavActive,
  type AssetDomainKey,
} from "@/config/assets";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";

type MatchMode = "exact" | "prefix";

/**
 * Docked Asset Management sidebar.
 * Top: IT / Non-IT domain switcher. Active domain expands workspace tabs.
 */
export function AssetsModuleSidebar() {
  const pathname = usePathname();
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
          setIsModuleAdmin(me.is_module_admin);
          setDomains(me.domains ?? []);
          setAdminDomains(me.admin_domains ?? []);
        }
      } catch {
        if (!cancelled) {
          setIsModuleAdmin(false);
          setDomains([]);
          setAdminDomains([]);
        }
      } finally {
        if (!cancelled) setAccessLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDomain: AssetDomainKey | null = useMemo(
    () => activeAssetDomainFromPath(pathname),
    [pathname],
  );

  const gatedNav = useMemo(() => {
    if (!accessLoaded) {
      // Prefer path domain while access loads — never assume IT for Non-IT routes.
      const pendingDomain = activeDomain ?? "NON_IT";
      return buildAssetSidebarNav({
        isModuleAdmin: false,
        domains: [pendingDomain],
        adminDomains: [],
        activeDomain: pendingDomain,
      });
    }
    return buildAssetSidebarNav({
      isModuleAdmin,
      domains,
      adminDomains,
      activeDomain,
    });
  }, [accessLoaded, isModuleAdmin, domains, adminDomains, activeDomain]);

  const { groups, matchModes } = useMemo(() => {
    const modes = new Map<string, MatchMode>();
    const mapped: ModuleNavGroup[] = gatedNav.map((group) => ({
      label: group.title,
      items: group.items.map((item) => {
        modes.set(`${item.href}|${item.title}`, item.match ?? "prefix");
        return { title: item.title, href: item.href, icon: item.icon };
      }),
    }));
    return { groups: mapped, matchModes: modes };
  }, [gatedNav]);

  const isActive = (item: ModuleNavItem): boolean => {
    if (item.href === "/assets" && item.title === "IT Assets") return activeDomain === "IT";
    if (item.href === "/assets/non-it" && item.title === "Non-IT Assets") {
      return activeDomain === "NON_IT";
    }
    return isAssetNavActive(
      pathname,
      item.href,
      matchModes.get(`${item.href}|${item.title}`) ?? "prefix",
    );
  };

  const subtitle = useMemo(() => {
    if (!accessLoaded) return "Assets";
    if (isModuleAdmin || (domains.includes("IT") && domains.includes("NON_IT"))) {
      return "IT · Non-IT";
    }
    if (domains.includes("NON_IT")) return "Non-IT";
    if (domains.includes("IT")) return "IT";
    return "Assets";
  }, [accessLoaded, isModuleAdmin, domains]);

  return (
    <ModuleSidebar
      moduleKey="assets"
      title="Asset Management"
      subtitle={subtitle}
      icon={Package}
      aria-label="Asset Management"
      testId="assets-module-sidebar"
      groups={groups}
      isActive={isActive}
      showAccount={false}
    />
  );
}
