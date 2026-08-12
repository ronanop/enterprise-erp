"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { detectMarketingPersona, marketingWorkspaceLabels } from "@/lib/marketing-role-ui";
import { cn } from "@/lib/utils";

type MarketingPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function MarketingPageHeader({ title, description, actions, className }: MarketingPageHeaderProps) {
  const perms = useMarketingPermissions();
  const persona = detectMarketingPersona(perms);
  const workspace = marketingWorkspaceLabels(persona);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04] sm:p-6",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-1/3 size-28 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3" aria-hidden />
              {workspace.section}
            </span>
            <span className="text-[11px] text-muted-foreground">{workspace.title}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
