"use client";

import { SetupField, SetupInput } from "@/components/hr/setup/setup-drawer";
import { cn } from "@/lib/utils";

export type EmployeeIdMode = "auto" | "manual";

export function EmployeeIdModeFields({
  mode,
  manualCode,
  nextAutoCode,
  disabled,
  onModeChange,
  onManualCodeChange,
}: {
  mode: EmployeeIdMode;
  manualCode: string;
  nextAutoCode?: string;
  disabled?: boolean;
  onModeChange: (mode: EmployeeIdMode) => void;
  onManualCodeChange: (value: string) => void;
}) {
  return (
    <SetupField
      label="Employee ID"
      hint={
        mode === "auto"
          ? "A new ID is generated when onboarding is completed."
          : "Enter the employee ID that should be assigned on completion."
      }
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <label className={cn("inline-flex cursor-pointer items-center gap-1.5", disabled && "cursor-not-allowed opacity-60")}>
          <input
            type="radio"
            name="employee-id-mode"
            className="cursor-pointer"
            checked={mode === "auto"}
            disabled={disabled}
            onChange={() => onModeChange("auto")}
          />
          Auto-generate
        </label>
        <label className={cn("inline-flex cursor-pointer items-center gap-1.5", disabled && "cursor-not-allowed opacity-60")}>
          <input
            type="radio"
            name="employee-id-mode"
            className="cursor-pointer"
            checked={mode === "manual"}
            disabled={disabled}
            onChange={() => onModeChange("manual")}
          />
          Manual
        </label>
      </div>
      {mode === "manual" ? (
        <SetupInput
          className="mt-1.5 font-mono"
          placeholder="e.g. EMP-000120"
          value={manualCode}
          disabled={disabled}
          onChange={(e) => onManualCodeChange(e.target.value.toUpperCase())}
        />
      ) : (
        <p className="mt-1.5 font-mono text-xs text-foreground">
          {nextAutoCode || "Assigned after completion"}
        </p>
      )}
    </SetupField>
  );
}
