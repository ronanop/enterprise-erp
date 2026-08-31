"use client";

import type { ReactNode } from "react";

import { TableRowsSkeleton } from "@/components/assets/shared";
import { ASSETS_SURFACE_CARD } from "@/components/assets/shared/premium-surface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WizardShellProps = {
  title: string;
  stepTitle: string;
  stepDescription?: string;
  branchLabel?: string;
  loading?: boolean;
  headerExtra?: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  progress?: ReactNode;
  footer: ReactNode;
  className?: string;
};

export function WizardShell({
  title,
  stepTitle,
  stepDescription,
  branchLabel,
  loading,
  headerExtra,
  children,
  sidebar,
  progress,
  footer,
  className,
}: WizardShellProps) {
  return (
    <div className={cn("min-w-0 space-y-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {branchLabel ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Branch: <span className="font-medium text-foreground">{branchLabel}</span>
            </p>
          ) : null}
        </div>
        {headerExtra}
      </div>

      {progress}

      <div
        className={cn(
          "grid min-w-0 gap-5",
          sidebar ? "lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]" : "",
        )}
      >
        {sidebar ? (
          <aside
            className="hidden lg:block"
            aria-label="Wizard steps"
          >
            <div
              className={cn(
                "sticky top-4 rounded-xl border border-border/70 bg-background/90 p-3 shadow-sm",
              )}
            >
              {sidebar}
            </div>
          </aside>
        ) : null}

        <Card className={cn(ASSETS_SURFACE_CARD, "min-h-[22rem] border-l-[3px] border-l-[#0369A1]")}>
          <CardHeader className="space-y-1 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold tracking-tight">{stepTitle}</CardTitle>
            {stepDescription ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{stepDescription}</p>
            ) : null}
          </CardHeader>
          <CardContent className="flex min-h-[16rem] flex-col gap-5 pt-5">
            {loading ? (
              <div aria-busy="true" aria-label="Loading wizard step">
                <TableRowsSkeleton rows={5} />
              </div>
            ) : (
              <div className="min-w-0 flex-1">{children}</div>
            )}
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
