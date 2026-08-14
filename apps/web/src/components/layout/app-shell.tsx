"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ProjectsSidebar } from "@/components/projects/projects-workspace-nav";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const standalone = useStandaloneChrome();
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");
  const isAssets = pathname === "/assets" || pathname.startsWith("/assets/");

  return (
    <div className="flex min-h-dvh w-full max-w-[100dvw] overflow-x-clip bg-background">
      {!standalone ? <AppSidebar /> : null}
      {standalone && isCrm ? <CrmSidebar /> : null}
      {standalone && isProjects ? <ProjectsSidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar />
        <main
          className={
            isAssets
              ? "min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-5 lg:px-6"
              : "min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8"
          }
        >
          <div
            className={
              isAssets
                ? "mx-auto w-full min-w-0 max-w-none animate-in fade-in-0 duration-300"
                : "mx-auto w-full min-w-0 max-w-[1400px] animate-in fade-in-0 duration-300"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
