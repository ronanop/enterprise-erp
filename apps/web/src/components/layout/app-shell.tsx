"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AssetsModuleSidebar } from "@/components/assets/assets-module-sidebar";
import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { ElevenLabsConvaiWidget } from "@/components/elevenlabs/convai-widget";
import { HrSidebar } from "@/components/hr/hr-sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ProcurementSidebar } from "@/components/procurement/procurement-workspace-nav";
import { ProjectsSidebar } from "@/components/projects/projects-workspace-nav";
import { isHrPath } from "@/config/hr-nav";
import { useHrmsColorMode } from "@/hooks/use-hrms-color-mode";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const standalone = useStandaloneChrome();
  const hrMode = isHrPath(pathname);
  const { dark } = useHrmsColorMode();
  const lockPageScroll = pathname === "/hr/edoc" || pathname.startsWith("/hr/edoc/");
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");
  const isProcurement =
    pathname === "/procurement" || pathname.startsWith("/procurement/");
  const isAssets = pathname === "/assets" || pathname.startsWith("/assets/");

  return (
    <div
      className={cn(
        "flex h-dvh w-full max-w-[100dvw] overflow-hidden overflow-x-clip bg-background",
        hrMode && "hrms-theme",
        hrMode && dark && "dark",
      )}
    >
      {hrMode ? (
        <HrSidebar />
      ) : standalone ? (
        <>
          {isCrm ? <CrmSidebar /> : null}
          {isProjects ? <ProjectsSidebar /> : null}
          {isProcurement ? <ProcurementSidebar /> : null}
          {isAssets ? <AssetsModuleSidebar /> : null}
        </>
      ) : (
        <AppSidebar />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar />
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-x-clip px-4 py-4 sm:px-6 lg:px-8",
            lockPageScroll ? "flex flex-col overflow-hidden" : "erp-scroll overflow-y-auto",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full min-w-0 animate-in fade-in-0 duration-300",
              pathname === "/hr" ? "max-w-[1680px]" : "max-w-[1400px]",
              lockPageScroll && "flex min-h-0 flex-1 flex-col overflow-hidden",
            )}
          >
            {children}
          </div>
        </main>
        {hrMode ? (
          <footer className="border-t border-border/70 bg-card/40 px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
              <span className="font-medium tracking-tight">HRMS workspace</span>
              <span>Workforce · Leave · Attendance · Talent · Hire · Pay</span>
            </div>
          </footer>
        ) : null}
      </div>
      <ElevenLabsConvaiWidget />
    </div>
  );
}
