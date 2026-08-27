"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WizardSelectOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_EMPLOYEES } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type {
  AssignmentWizardState,
  EmployeeSource,
} from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

const ALLOCATION_TYPES = ["employee", "department", "project", "branch", "warehouse"] as const;

const EMPLOYEE_MODES: Array<{ value: EmployeeSource; label: string; hint: string }> = [
  { value: "MASTER_DATA", label: "Select from directory", hint: "Employee exists in HR master data." },
  {
    value: "MANUAL_ENTRY",
    label: "Enter manually — employee not in directory",
    hint: "On payroll but deployed elsewhere; not in this company's directory.",
  },
];

export type EmployeeStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  showAdvancedAllocation?: boolean;
  employees?: WizardSelectOption[];
  fieldErrors?: Record<string, string>;
};

export function EmployeeStep({
  state,
  onChange,
  showAdvancedAllocation,
  employees = MOCK_EMPLOYEES,
  fieldErrors = {},
}: EmployeeStepProps) {
  const switchEmployeeSource = (next: EmployeeSource) => {
    if (next === state.employeeSource) return;
    if (next === "MANUAL_ENTRY") {
      onChange({
        employeeSource: "MANUAL_ENTRY",
        employeeId: "",
      });
      return;
    }
    onChange({
      employeeSource: "MASTER_DATA",
      manualEmployeeName: "",
      manualEmployeePhone: "",
      manualEmployeeEmail: "",
      manualEmployeeDeployedTo: "",
    });
  };

  const switchAllocation = (value: string) => {
    if (value === state.allocationType) return;
    onChange({
      allocationType: value,
      employeeId: "",
      employeeSource: "MASTER_DATA",
      manualEmployeeName: "",
      manualEmployeePhone: "",
      manualEmployeeEmail: "",
      manualEmployeeDeployedTo: "",
      departmentId: value === "department" ? state.departmentId : "",
      projectId: value === "project" ? state.projectId : "",
    });
  };

  return (
    <div className="grid max-w-xl gap-5">
      <div className="space-y-2">
        <Label htmlFor="wiz-allocation-type">Allocation type</Label>
        <Select value={state.allocationType} onValueChange={switchAllocation}>
          <SelectTrigger id="wiz-allocation-type" className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(showAdvancedAllocation ? ALLOCATION_TYPES : (["employee"] as const)).map((type) => (
              <SelectItem key={type} value={type} className="cursor-pointer capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.allocationType === "employee" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">How is this employee identified?</p>
          <div className="grid gap-2" role="group" aria-label="Employee source">
            {EMPLOYEE_MODES.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                variant={state.employeeSource === mode.value ? "default" : "outline"}
                className={cn(
                  "h-auto cursor-pointer justify-start py-2 text-left transition-colors duration-200",
                )}
                onClick={() => switchEmployeeSource(mode.value)}
              >
                <span>
                  <span className="block text-sm">{mode.label}</span>
                  <span className="block text-xs font-normal opacity-80">{mode.hint}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {state.allocationType === "employee" && state.employeeSource !== "MANUAL_ENTRY" ? (
        <div className="space-y-2">
          <Label htmlFor="wiz-employee">Employee *</Label>
          <Select
            value={state.employeeId || "__none"}
            onValueChange={(v) => onChange({ employeeId: v === "__none" ? "" : v })}
          >
            <SelectTrigger id="wiz-employee" className="cursor-pointer">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select employee…
              </SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                  {emp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.employee ? (
            <p className="text-xs text-destructive">{fieldErrors.employee}</p>
          ) : null}
        </div>
      ) : null}

      {state.allocationType === "employee" && state.employeeSource === "MANUAL_ENTRY" ? (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="wiz-manual-name">Name *</Label>
            <Input
              id="wiz-manual-name"
              value={state.manualEmployeeName}
              onChange={(e) => onChange({ manualEmployeeName: e.target.value })}
              autoComplete="name"
            />
            {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wiz-manual-phone">Phone *</Label>
            <Input
              id="wiz-manual-phone"
              value={state.manualEmployeePhone}
              onChange={(e) => onChange({ manualEmployeePhone: e.target.value })}
              autoComplete="tel"
            />
            {fieldErrors.phone ? <p className="text-xs text-destructive">{fieldErrors.phone}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wiz-manual-email">Email (can confirm later)</Label>
            <Input
              id="wiz-manual-email"
              type="email"
              value={state.manualEmployeeEmail}
              onChange={(e) => onChange({ manualEmployeeEmail: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wiz-manual-deployed">Deployed to *</Label>
            <Input
              id="wiz-manual-deployed"
              value={state.manualEmployeeDeployedTo}
              onChange={(e) => onChange({ manualEmployeeDeployedTo: e.target.value })}
              placeholder="e.g. Airtel — Gurugram office"
            />
            {fieldErrors["deployed-to"] ? (
              <p className="text-xs text-destructive">{fieldErrors["deployed-to"]}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              External company or location this person is deployed to.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
