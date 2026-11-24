"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ElevenLabsConvaiWidget } from "@/components/elevenlabs/convai-widget";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ShellSidebar } from "@/components/layout/module-sidebar-registry";
import { useMainScrollChain } from "@/hooks/use-main-scroll-chain";
import { useStandaloneChrome } from "@/hooks/use-standalone-chrome";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: left sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const standalone = useStandaloneChrome();
  const mainRef = useRef<HTMLElement>(null);
  useMainScrollChain(mainRef);
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
          className={`erp-scroll min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8 ${qrScanMode ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : ""
            }`}
        >
          <div className="mx-auto w-full min-w-0 max-w-[1400px] animate-in fade-in-50 slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
            {children}
          </div>
        </main>
      </div>
      <ElevenLabsConvaiWidget />
    </div>
  );
}
