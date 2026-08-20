"use client";

import type { WizardEmployeeOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { EmptyState } from "@/components/assets/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

export type EmployeeStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  showAdvancedAllocation?: boolean;
  employees?: WizardEmployeeOption[];
  readOnly?: boolean;
  /** True while employee directory is loading from the container. */
  loading?: boolean;
};

function asEmployeeOptions(employees: WizardEmployeeOption[]): WizardEmployeeOption[] {
  return employees.map((e) => ({
    ...e,
    name: e.name ?? e.label,
    employeeCode: e.employeeCode ?? "",
  }));
}

function formatStatus(status: string | undefined): string {
  if (!status) return "—";
  return status.replace(/_/g, " ");
}

export function EmployeeStep({
  state,
  onChange,
  showAdvancedAllocation,
  employees = [],
  readOnly,
  loading,
}: EmployeeStepProps) {
  const options = useMemo(() => asEmployeeOptions(employees), [employees]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((e) => {
      const hay =
        `${e.employeeCode ?? ""} ${e.name ?? ""} ${e.label} ${e.department ?? ""} ${e.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  const selected = options.find((e) => e.id === state.employeeId) ?? null;

  function selectEmployee(id: string) {
    if (readOnly) return;
    if (!id) {
      onChange({ employeeId: "", departmentId: "" });
      return;
    }
    const emp = options.find((e) => e.id === id);
    onChange({
      employeeId: id,
      departmentId: emp?.departmentId ?? "",
    });
  }

  return (
    <div className="grid max-w-3xl gap-4" data-testid="employee-information-section">
      <div>
        <h3 className="text-sm font-medium tracking-tight">Employee Information</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Search and select an employee. Profile fields fill automatically and stay read-only.
        </p>
      </div>

      {showAdvancedAllocation ? (
        <div className="space-y-2">
          <Label htmlFor="wiz-allocation-type">Allocation type</Label>
          <Select
            value={state.allocationType}
            onValueChange={(value) => onChange({ allocationType: value })}
            disabled={readOnly || loading}
          >
            <SelectTrigger id="wiz-allocation-type" className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["employee", "department", "project", "branch", "warehouse"] as const).map(
                (type) => (
                  <SelectItem key={type} value={type} className="cursor-pointer capitalize">
                    {type}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {loading ? (
        <EmployeeInfoSkeleton />
      ) : options.length === 0 ? (
        <div data-testid="employee-directory-empty">
          <EmptyState
            variant="no-results"
            compact
            title="No employees available"
            description="Add employees in Master Data, then refresh this wizard."
            className="rounded-lg border border-dashed border-border/70 bg-muted/10"
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="wiz-employee-search">Search Employee (Employee ID / Name)</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="wiz-employee-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type employee ID or name…"
                disabled={readOnly || loading}
                className="cursor-text pl-8"
                autoComplete="off"
                data-testid="employee-search-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wiz-employee">Select employee *</Label>
            <Select
              value={state.employeeId || "__none"}
              onValueChange={(v) => selectEmployee(v === "__none" ? "" : v)}
              disabled={readOnly}
            >
              <SelectTrigger id="wiz-employee" className="cursor-pointer" data-testid="employee-select">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="cursor-pointer">
                  Clear selection…
                </SelectItem>
                {filtered.length === 0 ? (
                  <SelectItem value="__empty" disabled className="cursor-default">
                    No matches
                  </SelectItem>
                ) : (
                  filtered.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                      {(emp.employeeCode ? `${emp.employeeCode} — ` : "") + (emp.name || emp.label)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!readOnly && filtered.length > 0 && search.trim() ? (
              <ul
                className="max-h-40 overflow-y-auto rounded-md border border-border/70 divide-y divide-border/50"
                data-testid="employee-search-results"
              >
                {filtered.slice(0, 8).map((emp) => {
                  const active = emp.id === state.employeeId;
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/50",
                          active && "bg-primary/5",
                        )}
                        onClick={() => selectEmployee(emp.id)}
                      >
                        <span className="font-medium text-foreground">
                          {emp.name || emp.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {emp.employeeCode || emp.id.slice(0, 8)}
                          {emp.department ? ` · ${emp.department}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {!selected ? (
            <div data-testid="employee-empty-state">
              <EmptyState
                variant="no-results"
                compact
                title="No employee selected"
                description="Search by Employee ID or name, then choose an employee to auto-fill the profile."
                className="rounded-lg border border-dashed border-border/70 bg-muted/10"
              />
            </div>
          ) : (
            <div
              className="grid gap-3 rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:grid-cols-2"
              data-testid="employee-profile-fields"
            >
              <div className="sm:col-span-2 mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <UserRound className="size-3.5" aria-hidden />
                Selected employee profile (read-only)
              </div>
              <ReadField label="Employee ID" value={selected.employeeCode || "—"} mono />
              <ReadField label="Employee Name" value={selected.name || selected.label || "—"} />
              <ReadField label="Department" value={selected.department || "—"} />
              <ReadField label="Designation" value={selected.designation || "—"} />
              <ReadField label="Branch" value={selected.branch || "—"} />
              <ReadField label="Phone Number" value={selected.phone || "—"} />
              <ReadField label="Email" value={selected.email || "—"} />
              <ReadField label="Manager" value={selected.manager || "—"} />
              <ReadField
                label="Employment Status"
                value={formatStatus(selected.employmentStatus)}
                className="sm:col-span-2"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReadField({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function EmployeeInfoSkeleton() {
  return (
    <div
      className="space-y-3 rounded-lg border border-border/70 bg-card p-3"
      aria-busy="true"
      aria-label="Loading employees"
      data-testid="employee-info-skeleton"
    >
      <div className="h-9 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border/50 p-3">
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
