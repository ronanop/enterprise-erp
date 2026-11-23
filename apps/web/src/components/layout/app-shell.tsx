"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppTopbar } from "@/components/layout/app-topbar";
import { ShellSidebar } from "@/components/layout/module-sidebar-registry";
import { useMainScrollChain } from "@/hooks/use-main-scroll-chain";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: HR sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const standalone = useStandaloneChrome();
  const mainRef = useRef<HTMLElement>(null);
  useMainScrollChain(mainRef);
  return (
    <div className="flex h-dvh w-full max-w-[100dvw] overflow-hidden bg-background">
      <ShellSidebar pathname={pathname} standalone={standalone} />
      <div id="erp-workspace-main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar />
        <main
          ref={mainRef}
          className="erp-scroll min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
        >
          <div className="mx-auto w-full min-w-0 max-w-[1400px] animate-in fade-in-50 slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
            {children}
          </div>
        </main>
        <footer className="border-t border-border/70 bg-card/40 px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <span className="font-medium tracking-tight">HRMS workspace</span>
            <span>Workforce · Leave · Attendance · Talent · Hire · Pay</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
