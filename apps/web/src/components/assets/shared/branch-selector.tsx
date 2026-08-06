"use client";

import { cn } from "@/lib/utils";

export const BRANCH_ALL_VALUE = "all";

export type BranchOption = {
  id: string;
  label: string;
};

export type BranchSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  branches: BranchOption[];
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  "aria-label"?: string;
};

export function BranchSelector({
  value,
  onChange,
  branches,
  includeAll = true,
  allLabel = "All",
  className,
  "aria-label": ariaLabel = "Branch filter",
}: BranchSelectorProps) {
  const options: BranchOption[] = includeAll
    ? [{ id: BRANCH_ALL_VALUE, label: allLabel }, ...branches]
    : branches;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            className={cn(
              "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:bg-muted/80",
            )}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
