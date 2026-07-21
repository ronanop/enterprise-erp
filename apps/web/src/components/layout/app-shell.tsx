import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

interface AppShellProps {
  children: ReactNode;
}

/** Primary application chrome: sidebar + topbar + content. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] animate-in fade-in-0 duration-300">{children}</div>
        </main>
        <footer className="border-t border-border/70 bg-card/40 px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <span className="font-medium tracking-tight">Architecture Baseline v1.1</span>
            <span>Clean Architecture · DDD · Modular Monolith</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
