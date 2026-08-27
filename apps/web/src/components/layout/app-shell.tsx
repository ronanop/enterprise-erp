"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { HrSidebar } from "@/components/hr/hr-sidebar";
import { isHrPath } from "@/config/hr-nav";
import { useHrmsColorMode } from "@/hooks/use-hrms-color-mode";

import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hrMode = isHrPath(pathname);
  const { dark } = useHrmsColorMode();

  return (
    <div
      className={cn(
        "flex h-dvh overflow-hidden bg-background",
        hrMode && "hrms-theme",
        hrMode && dark && "dark",
      )}
    >
      {hrMode ? <HrSidebar /> : <AppSidebar />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="erp-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] animate-in fade-in-0 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
