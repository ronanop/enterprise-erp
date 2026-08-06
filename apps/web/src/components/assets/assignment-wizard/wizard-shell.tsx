"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableRowsSkeleton } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type WizardShellProps = {
  title: string;
  stepTitle: string;
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
    <div className={cn("space-y-4", className)}>
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
      <div className="grid gap-4 lg:grid-cols-[minmax(11rem,14rem)_1fr]">
        {sidebar ? (
          <aside className="hidden lg:block" aria-label="Wizard steps">
            {sidebar}
          </aside>
        ) : null}
        <Card className="min-h-[20rem]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{stepTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[16rem] flex-col gap-4">
            {loading ? (
              <div aria-busy="true" aria-label="Loading wizard step">
                <TableRowsSkeleton rows={4} />
              </div>
            ) : (
              children
            )}
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
