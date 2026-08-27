"use client";

import type { ReactNode } from "react";

import { TableRowsSkeleton } from "@/components/assets/shared";
import type { WizardStepMeta } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

export type IssueFormShellProps = {
  title: string;
  branchLabel?: string;
  loading?: boolean;
  headerExtra?: ReactNode;
  sections: WizardStepMeta[];
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

export function IssueFormShell({
  title,
  branchLabel,
  loading,
  headerExtra,
  sections,
  children,
  footer,
  className,
}: IssueFormShellProps) {
  return (
    <div className={cn("min-w-0 space-y-6", className)}>
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
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Issue asset sections">
          <ol className="sticky top-4 m-0 list-none space-y-1 p-0">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#issue-${section.id}`}
                  className="block cursor-pointer rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 space-y-8">
          {loading ? (
            <div aria-busy="true" aria-label="Loading issue form">
              <TableRowsSkeleton rows={8} />
            </div>
          ) : (
            children
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}

export function IssueFormSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`issue-${id}`}
      aria-labelledby={`issue-${id}-heading`}
      className="scroll-mt-6 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
    >
      <h2 id={`issue-${id}-heading`} className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}
