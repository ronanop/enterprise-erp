"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { MarketingSidebar } from "@/components/marketing/marketing-workspace-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ProjectsSidebar } from "@/components/projects/projects-workspace-nav";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";
import {
  FIELD_ENGINEER_HOME,
  isServiceFieldEngineerOnly,
} from "@/lib/service-field-engineer-access";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const standalone = useStandaloneChrome();
  const { profile, loading } = useUserPermissions();
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");
  const isMarketing = pathname === "/marketing" || pathname.startsWith("/marketing/");

  const feOnly =
    !loading &&
    isServiceFieldEngineerOnly(profile?.roleCodes, profile?.permissions, profile?.roleNames);

  useEffect(() => {
    if (!feOnly) return;
    if (!pathname.startsWith(FIELD_ENGINEER_HOME)) {
      router.replace(FIELD_ENGINEER_HOME);
    }
  }, [feOnly, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (feOnly && !pathname.startsWith(FIELD_ENGINEER_HOME)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Opening field engineer dashboard…</p>
      </div>
    );
  }

  const hideModuleSidebar = standalone || feOnly;

  return (
    <div className="flex min-h-dvh w-full max-w-[100dvw] overflow-x-clip bg-background">
      {!hideModuleSidebar ? <AppSidebar /> : null}
      {standalone && isCrm ? <CrmSidebar /> : null}
      {standalone && isProjects ? <ProjectsSidebar /> : null}
      {standalone && isMarketing ? <MarketingSidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar />
        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1400px] animate-in fade-in-0 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
