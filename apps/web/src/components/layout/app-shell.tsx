"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ElevenLabsConvaiWidget } from "@/components/elevenlabs/convai-widget";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ShellSidebar } from "@/components/layout/module-sidebar-registry";
import { isHrPath } from "@/config/hr-nav";
import { useMainScrollChain } from "@/hooks/use-main-scroll-chain";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Dense modules fill the freed width when the rail collapses (no 1400px gutters). */
function usesFullWorkspaceWidth(pathname: string): boolean {
  return (
    pathname === "/assets" ||
    pathname.startsWith("/assets/") ||
    pathname === "/hr" ||
    pathname.startsWith("/hr/")
  );
}

/** Primary application chrome: left sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const standalone = useStandaloneChrome();
  const mainRef = useRef<HTMLElement>(null);
  useMainScrollChain(mainRef);
  const hrMode = isHrPath(pathname);
  const fullWidth = usesFullWorkspaceWidth(pathname);
  /** QR scan focus mode — full portal without the assets dock (better on phones). */
  const qrScanMode =
    searchParams.get("from") === "qr" && pathname.startsWith("/assets/information-portal/");

  // Keep a single scrollport (main). Body/html scroll creates a second right-edge bar
  // when this flex child's min-height:auto grows past the viewport.
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    html.classList.add("erp-app-shell-lock");
    body.classList.add("erp-app-shell-lock");
    return () => {
      html.classList.remove("erp-app-shell-lock");
      body.classList.remove("erp-app-shell-lock");
    };
  }, []);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 w-full max-w-[100dvw] flex-1 overflow-hidden bg-background">
      <ShellSidebar pathname={pathname} standalone={standalone} hideSidebar={qrScanMode} />
      <div id="erp-workspace-main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar />
        <main
          ref={mainRef}
          className={`erp-scroll min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 md:px-5 lg:px-6 ${qrScanMode ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : ""
            }`}
        >
          <div
            className={`w-full min-w-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none ${
              fullWidth ? "max-w-none" : "mx-auto max-w-[1400px]"
            }`}
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
