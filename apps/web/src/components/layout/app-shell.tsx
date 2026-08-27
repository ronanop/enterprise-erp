"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { ElevenLabsConvaiWidget } from "@/components/elevenlabs/convai-widget";
import { HrSidebar } from "@/components/hr/hr-sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ProcurementSidebar } from "@/components/procurement/procurement-workspace-nav";
import { ProjectsSidebar } from "@/components/projects/projects-workspace-nav";
import { isHrPath } from "@/config/hr-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const standalone = useStandaloneChrome();
  const hrMode = isHrPath(pathname);
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");
  const isProcurement =
    pathname === "/procurement" || pathname.startsWith("/procurement/");

  return (
    <div className="flex min-h-dvh w-full max-w-[100dvw] overflow-x-clip bg-background">
      {hrMode ? (
        <HrSidebar />
      ) : standalone ? (
        <>
          {isCrm ? <CrmSidebar /> : null}
          {isProjects ? <ProjectsSidebar /> : null}
          {isProcurement ? <ProcurementSidebar /> : null}
        </>
      ) : (
        <AppSidebar />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar />
        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1400px] animate-in fade-in-0 duration-300">
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
