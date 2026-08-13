"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CrmSidebar } from "@/components/crm/crm-workspace-nav";
import { ProcurementSidebar } from "@/components/procurement/procurement-workspace-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { cn } from "@/lib/utils";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const standalone = useStandaloneChrome();
  const isCrm = pathname === "/crm" || pathname.startsWith("/crm/");
  const isProcurement = pathname === "/procurement" || pathname.startsWith("/procurement/");
  const useProcurementSidebar = isProcurement;
  const hideAppSidebar = standalone || useProcurementSidebar;

  return (
    <div
      className={cn(
        "flex min-h-dvh w-full max-w-[100dvw] overflow-x-clip bg-background",
        useProcurementSidebar && "bg-slate-50",
      )}
    >
      {!hideAppSidebar ? <AppSidebar /> : null}
      {standalone && isCrm ? <CrmSidebar /> : null}
      {useProcurementSidebar ? <ProcurementSidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppTopbar />
        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8",
            useProcurementSidebar && "bg-slate-50",
          )}
        >
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
