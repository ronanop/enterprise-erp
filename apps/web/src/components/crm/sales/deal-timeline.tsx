"use client";

import Link from "next/link";
import { ArrowRight, Building2, Check, FileText, Handshake, Target, Trophy, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type DealStage = "company" | "lead" | "opportunity" | "quote" | "ovf" | "won";
type DealLinks = Partial<Record<DealStage, string>>;
type NextStep = {
  label: string;
  description: string;
  href?: string;
};

const STEPS: Array<{ key: DealStage; label: string; icon: typeof Building2 }> = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "lead", label: "Lead", icon: Target },
  { key: "opportunity", label: "Opportunity", icon: Handshake },
  { key: "quote", label: "Quote", icon: FileText },
  { key: "ovf", label: "OVF", icon: FileText },
  { key: "won", label: "Won", icon: Trophy },
];

/**
 * Navigable stepper for the sales blueprint. Existing records become links,
 * and an optional handoff prompt keeps the user moving without using the CRM
 * workspace tabs.
 */
export function DealTimeline({
  current,
  lost,
  links,
  nextStep,
}: {
  current: DealStage;
  lost?: boolean;
  links?: DealLinks;
  nextStep?: NextStep;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="erp-scroll flex items-center gap-0.5 overflow-x-auto px-3 py-2.5">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx && !lost;
          const isCurrent = idx === currentIdx && !lost;
          const isLostHere = lost && idx === currentIdx;
          const href = links?.[step.key];
          const Icon = step.icon;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  isLostHere && "border-destructive bg-destructive text-white",
                  isDone && "border-emerald-600 bg-emerald-600 text-white",
                  !isCurrent && !isLostHere && !isDone && "border-border/80 bg-muted/40",
                )}
              >
                {isDone ? (
                  <Check className="size-3" />
                ) : isLostHere ? (
                  <X className="size-3" />
                ) : (
                  <Icon className="size-3" />
                )}
              </span>
              {step.label}
            </>
          );
          return (
            <div key={step.key} className="flex items-center">
              {href ? (
                <Link
                  href={href}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap outline-none transition-colors duration-200",
                    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isCurrent && "bg-primary/10 text-primary",
                    isLostHere && "bg-destructive/10 text-destructive",
                    isDone && "text-emerald-700",
                    !isCurrent && !isLostHere && !isDone && "text-muted-foreground",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap",
                    isCurrent && "bg-primary/10 text-primary",
                    isLostHere && "bg-destructive/10 text-destructive",
                    isDone && "text-emerald-700",
                    !isCurrent && !isLostHere && !isDone && "text-muted-foreground",
                  )}
                >
                  {content}
                </div>
              )}
              {idx < STEPS.length - 1 ? (
                <div
                className={cn(
                  "h-px w-4 shrink-0",
                  isDone ? "bg-emerald-500" : "bg-border/70",
                )}
              />
              ) : null}
            </div>
          );
        })}
        {lost ? (
          <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            <X className="size-3" /> Lost — exited blueprint
          </span>
        ) : null}
      </div>
      {nextStep && !lost ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Next: {nextStep.label}</p>
            <p className="text-[11px] text-muted-foreground">{nextStep.description}</p>
          </div>
          {nextStep.href ? (
            <Link
              href={nextStep.href}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground outline-none transition-opacity duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Continue <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
