"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WizardStepMeta } from "@/components/assets/assignment-wizard/wizard-types";

export type WizardStepperProps = {
  steps: WizardStepMeta[];
  currentIndex: number;
  maxVisitedIndex: number;
  onStepClick?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function WizardStepper({
  steps,
  currentIndex,
  maxVisitedIndex,
  onStepClick,
  orientation = "vertical",
  className,
}: WizardStepperProps) {
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label="Wizard progress"
      className={cn(
        isVertical ? "flex flex-col gap-1" : "flex w-full flex-col gap-2",
        className,
      )}
    >
      <ol
        className={cn(
          "m-0 list-none p-0",
          isVertical ? "space-y-1" : "flex flex-wrap items-center gap-1.5",
        )}
      >
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const canNavigate = Boolean(index <= maxVisitedIndex && onStepClick);
          return (
            <li
              key={step.id}
              className={cn(isVertical ? "w-full" : "min-w-0 flex-1 sm:flex-none")}
            >
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => canNavigate && onStepClick?.(index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200",
                  canNavigate ? "cursor-pointer hover:bg-muted/70" : "cursor-default opacity-70",
                  isActive && "bg-[rgba(3,105,161,0.08)] font-medium text-foreground",
                  !isActive && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                    isActive && "border-[#0369A1] bg-[#0369A1] text-white",
                    isComplete &&
                      !isActive &&
                      "border-[#0369A1]/50 bg-[rgba(3,105,161,0.12)] text-[#0369A1]",
                    !isActive && !isComplete && "border-border bg-background",
                  )}
                  aria-hidden
                >
                  {isComplete ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span className={cn("truncate", !isVertical && "hidden sm:inline")}>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>
    </nav>
  );
}

export function WizardProgressBar({
  currentIndex,
  totalSteps,
  className,
}: {
  currentIndex: number;
  totalSteps: number;
  className?: string;
}) {
  const pct = totalSteps > 0 ? Math.round(((currentIndex + 1) / totalSteps) * 100) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Step {currentIndex + 1} of {totalSteps}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Wizard progress"
      >
        <div
          className="h-full rounded-full bg-[#0369A1] transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
