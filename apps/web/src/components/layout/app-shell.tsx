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
  const lockPageScroll = pathname === "/hr/edoc" || pathname.startsWith("/hr/edoc/");

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
        <main
          className={cn(
            "min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8",
            lockPageScroll ? "flex flex-col overflow-hidden" : "erp-scroll overflow-y-auto",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full animate-in fade-in-0 duration-300",
              pathname === "/hr" ? "max-w-[1680px]" : "max-w-[1400px]",
              lockPageScroll && "flex min-h-0 flex-1 flex-col overflow-hidden",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
