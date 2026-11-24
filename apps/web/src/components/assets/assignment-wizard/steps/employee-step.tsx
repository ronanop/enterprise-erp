"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { listDepartmentOptions } from "@/lib/org-options";
import { cn } from "@/lib/utils";

const ALLOCATION_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "department", label: "Department" },
] as const;

const EMPLOYEE_MODES: Array<{ value: EmployeeSource; label: string }> = [
  { value: "MASTER_DATA", label: "From Directory" },
  { value: "MANUAL_ENTRY", label: "Enter Manually" },
];

export type EmployeeStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  employees?: WizardSelectOption[];
  departments?: WizardSelectOption[];
};

export function EmployeeStep({
  state,
  onChange,
  employees = MOCK_EMPLOYEES,
  departments: departmentsProp,
}: EmployeeStepProps) {
  const [loadedDepartments, setLoadedDepartments] = useState<WizardSelectOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  useEffect(() => {
    if (departmentsProp) return;
    let cancelled = false;
    setDepartmentsLoading(true);
    void listDepartmentOptions()
      .then((rows) => {
        if (cancelled) return;
        setLoadedDepartments(rows.map((d) => ({ id: d.id, label: d.label })));
      })
      .catch(() => {
        if (!cancelled) setLoadedDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentsProp]);

  const departments = departmentsProp ?? loadedDepartments;

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
      projectId: "",
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
            {ALLOCATION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.allocationType === "employee" ? (
        <div
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          role="group"
          aria-label="Employee source"
        >
          {EMPLOYEE_MODES.map((mode) => {
            const active = state.employeeSource === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => switchEmployeeSource(mode.value)}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors duration-200",
                  active
                    ? "border-[#0369A1] bg-[rgba(3,105,161,0.08)] shadow-sm"
                    : "border-border/80 hover:bg-muted/40",
                )}
              >
                <span className="block text-sm font-medium text-foreground">{mode.label}</span>
              </button>
            );
          })}
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="wiz-manual-phone">Phone *</Label>
            <Input
              id="wiz-manual-phone"
              value={state.manualEmployeePhone}
              onChange={(e) => onChange({ manualEmployeePhone: e.target.value })}
              autoComplete="tel"
            />
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
              placeholder=""
            />
          </div>
        </div>
      ) : null}

      {state.allocationType === "department" ? (
        <div className="space-y-2">
          <Label htmlFor="wiz-department">Department *</Label>
          <Select
            value={state.departmentId || "__none"}
            onValueChange={(v) => onChange({ departmentId: v === "__none" ? "" : v })}
            disabled={departmentsLoading && !departmentsProp}
          >
            <SelectTrigger
              id="wiz-department"
              className="cursor-pointer"
              data-testid="wiz-department-select"
            >
              <SelectValue
                placeholder={departmentsLoading ? "Loading departments…" : "Select department"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" className="cursor-pointer">
                Select department…
              </SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id} className="cursor-pointer">
                  {dept.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
