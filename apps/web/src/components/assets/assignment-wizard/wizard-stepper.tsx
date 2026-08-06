"use client";

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
        isVertical ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      <ol
        className={cn(
          "m-0 list-none p-0",
          isVertical ? "space-y-1" : "flex flex-wrap items-center gap-1",
        )}
      >
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const canNavigate = index <= maxVisitedIndex && onStepClick;
          return (
            <li
              key={step.id}
              className={cn(isVertical ? "w-full" : "flex items-center gap-1")}
            >
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => canNavigate && onStepClick(index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-200",
                  canNavigate ? "cursor-pointer hover:bg-muted/60" : "cursor-default",
                  isActive && "bg-muted/80 font-medium text-foreground",
                  !isActive && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    isComplete && !isActive && "border-primary/40 bg-primary/10 text-primary",
                    !isActive && !isComplete && "border-border",
                  )}
                  aria-hidden
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
              {!isVertical && index < steps.length - 1 ? (
                <span className="text-muted-foreground" aria-hidden>
                  /
                </span>
              ) : null}
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
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Step {currentIndex + 1} of {totalSteps}
        </span>
        <span>{pct}%</span>
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
          className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
