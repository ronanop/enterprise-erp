"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listEmployeeDirectory,
  type EmployeeDirectoryEntry,
} from "@/lib/org-options";
import { cn } from "@/lib/utils";
import {
  listNonItLocations,
  type NonItAssignmentMode,
  type NonItLocation,
} from "@/services/nonit-asset-service";

export type AssignmentTarget = {
  employee_id: string | null;
  location_id: string | null;
};

type Props = {
  assignmentMode: NonItAssignmentMode | string;
  value: AssignmentTarget;
  onChange: (next: AssignmentTarget) => void;
  disabled?: boolean;
  /** Open employee suggestions above the field when near page bottom. */
  suggestionsPlacement?: "down" | "up";
};

/**
 * Employee typeahead and/or location select driven by asset type assignment_mode.
 * BOTH: user picks Employee or Location first, then the matching field.
 */
export function NonItAssignmentPicker({
  assignmentMode,
  value,
  onChange,
  disabled,
  suggestionsPlacement = "down",
}: Props) {
  const mode = String(assignmentMode || "EMPLOYEE").toUpperCase();
  const showEmployee = mode === "EMPLOYEE" || mode === "BOTH";
  const showLocation = mode === "LOCATION" || mode === "BOTH";

  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [locations, setLocations] = useState<NonItLocation[]>([]);
  const [empQuery, setEmpQuery] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const [kind, setKind] = useState<"employee" | "location">(
    mode === "LOCATION" ? "location" : "employee",
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (showEmployee) {
        try {
          const opts = await listEmployeeDirectory();
          if (!cancelled) setEmployees(opts);
        } catch {
          if (!cancelled) setEmployees([]);
        }
      }
      if (showLocation) {
        try {
          const locs = await listNonItLocations({ active: true });
          if (!cancelled) setLocations(locs);
        } catch {
          if (!cancelled) setLocations([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showEmployee, showLocation]);

  useEffect(() => {
    if (mode === "LOCATION") setKind("location");
    else if (mode === "EMPLOYEE") setKind("employee");
  }, [mode]);

  useEffect(() => {
    if (!empOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setEmpOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [empOpen]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === value.employee_id) ?? null,
    [employees, value.employee_id],
  );

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 40);
    return employees
      .filter(
        (e) =>
          e.displayName.toLowerCase().includes(q) ||
          (e.employeeCode ?? "").toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [employees, empQuery]);

  function selectEmployee(entry: EmployeeDirectoryEntry) {
    onChange({ employee_id: entry.id, location_id: null });
    setEmpQuery(entry.displayName);
    setEmpOpen(false);
  }

  function clearEmployee() {
    onChange({ employee_id: null, location_id: value.location_id });
    setEmpQuery("");
  }

  function selectLocation(id: string) {
    onChange({ employee_id: null, location_id: id || null });
  }

  const showEmpField = showEmployee && (mode !== "BOTH" || kind === "employee");
  const showLocField = showLocation && (mode !== "BOTH" || kind === "location");

  return (
    <div className="space-y-3">
      {mode === "BOTH" ? (
        <div className="flex gap-2" role="group" aria-label="Assignment target kind">
          <Button
            type="button"
            size="sm"
            variant={kind === "employee" ? "default" : "outline"}
            className="cursor-pointer transition-colors duration-200"
            disabled={disabled}
            onClick={() => {
              setKind("employee");
              onChange({ employee_id: value.employee_id, location_id: null });
            }}
          >
            Employee
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "location" ? "default" : "outline"}
            className="cursor-pointer transition-colors duration-200"
            disabled={disabled}
            onClick={() => {
              setKind("location");
              onChange({ employee_id: null, location_id: value.location_id });
              setEmpQuery("");
            }}
          >
            Location
          </Button>
        </div>
      ) : null}

      {showEmpField ? (
        <div className="space-y-1.5" ref={rootRef}>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="nonit-emp-search">
            Employee
          </label>
          <div className="relative">
            <Input
              id="nonit-emp-search"
              placeholder="Type a name or employee code…"
              value={
                selectedEmployee && !empOpen
                  ? selectedEmployee.displayName
                  : empQuery
              }
              disabled={disabled}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={empOpen}
              onFocus={() => {
                setEmpOpen(true);
                if (selectedEmployee) setEmpQuery(selectedEmployee.displayName);
              }}
              onChange={(e) => {
                setEmpQuery(e.target.value);
                setEmpOpen(true);
                if (value.employee_id) {
                  onChange({ employee_id: null, location_id: null });
                }
              }}
            />
            {empOpen && !disabled ? (
              <ul
                className={cn(
                  "absolute z-40 max-h-48 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-lg",
                  suggestionsPlacement === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5",
                )}
                role="listbox"
                data-testid="nonit-employee-suggestions"
              >
                {filteredEmployees.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
                ) : (
                  filteredEmployees.map((e) => (
                    <li key={e.id} role="option">
                      <button
                        type="button"
                        className={cn(
                          "flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/80",
                          value.employee_id === e.id && "bg-muted/60",
                        )}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => selectEmployee(e)}
                      >
                        <span className="font-medium text-foreground">{e.displayName}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {e.employeeCode ?? "No employee code"}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          {selectedEmployee ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs">
              <span>
                <span className="text-muted-foreground">Selected: </span>
                <span className="font-medium text-foreground">{selectedEmployee.displayName}</span>
                {selectedEmployee.employeeCode ? (
                  <span className="ml-1.5 font-mono text-muted-foreground">
                    ({selectedEmployee.employeeCode})
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer px-2 text-xs"
                disabled={disabled}
                onClick={clearEmployee}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showLocField ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="nonit-loc">
            Location
          </label>
          <select
            id="nonit-loc"
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
            value={value.location_id ?? ""}
            disabled={disabled}
            onChange={(e) => selectLocation(e.target.value)}
          >
            <option value="">Select location…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
