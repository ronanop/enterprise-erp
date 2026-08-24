"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.hr.workforce.tablePrefs.v1";

export type EmployeeTableColumnKey =
  | "employeeCode"
  | "name"
  | "entity"
  | "organisation"
  | "branch"
  | "location"
  | "designation"
  | "department"
  | "reportingManager"
  | "employmentType"
  | "gender"
  | "email"
  | "phone"
  | "grade"
  | "jobLevel"
  | "shift"
  | "legalEntity"
  | "managementGroup"
  | "leavePolicy"
  | "dob"
  | "maritalStatus"
  | "joiningDate"
  | "confirmationDate"
  | "status";

export type EmployeeTablePrefs = {
  visibleColumns: EmployeeTableColumnKey[];
};

/** Columns shown by default (matches original workforce grid). */
export const DEFAULT_EMPLOYEE_TABLE_COLUMNS: EmployeeTableColumnKey[] = [
  "employeeCode",
  "name",
  "entity",
  "organisation",
  "location",
  "designation",
  "department",
  "reportingManager",
  "employmentType",
  "joiningDate",
  "status",
];

/** Always visible — cannot be hidden. */
export const REQUIRED_EMPLOYEE_TABLE_COLUMNS: EmployeeTableColumnKey[] = [
  "employeeCode",
  "name",
];

export const EMPLOYEE_TABLE_COLUMN_LABELS: Record<EmployeeTableColumnKey, string> = {
  employeeCode: "Emp Code",
  name: "Name",
  entity: "Entity",
  organisation: "Organisation",
  branch: "Branch",
  location: "Base Location",
  designation: "Designation",
  department: "Department",
  reportingManager: "Reporting Manager",
  employmentType: "Type",
  gender: "Gender",
  email: "Official Email",
  phone: "Phone",
  grade: "Grade",
  jobLevel: "Job Level",
  shift: "Shift",
  legalEntity: "Legal Entity",
  managementGroup: "Management Group",
  leavePolicy: "Leave Policy",
  dob: "Date of Birth",
  maritalStatus: "Marital Status",
  joiningDate: "Joined",
  confirmationDate: "Confirmation",
  status: "Status",
};

const ALL_COLUMN_KEYS = Object.keys(EMPLOYEE_TABLE_COLUMN_LABELS) as EmployeeTableColumnKey[];

const DEFAULTS: EmployeeTablePrefs = {
  visibleColumns: DEFAULT_EMPLOYEE_TABLE_COLUMNS,
};

function normalizeVisible(columns: string[] | undefined): EmployeeTableColumnKey[] {
  const allowed = new Set(ALL_COLUMN_KEYS);
  const picked = (columns ?? DEFAULTS.visibleColumns).filter((c): c is EmployeeTableColumnKey =>
    allowed.has(c as EmployeeTableColumnKey),
  );
  for (const required of REQUIRED_EMPLOYEE_TABLE_COLUMNS) {
    if (!picked.includes(required)) picked.unshift(required);
  }
  return picked.length ? picked : [...DEFAULT_EMPLOYEE_TABLE_COLUMNS];
}

export function useEmployeeTablePrefs() {
  const [prefs, setPrefs] = useState<EmployeeTablePrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EmployeeTablePrefs>;
        setPrefs({
          visibleColumns: normalizeVisible(parsed.visibleColumns),
        });
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, ready]);

  function toggleColumn(key: EmployeeTableColumnKey) {
    if (REQUIRED_EMPLOYEE_TABLE_COLUMNS.includes(key)) return;
    setPrefs((prev) => {
      const set = new Set(prev.visibleColumns);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      for (const required of REQUIRED_EMPLOYEE_TABLE_COLUMNS) set.add(required);
      return { visibleColumns: ALL_COLUMN_KEYS.filter((k) => set.has(k)) };
    });
  }

  function resetColumns() {
    setPrefs({ visibleColumns: [...DEFAULT_EMPLOYEE_TABLE_COLUMNS] });
  }

  return { prefs, setPrefs, toggleColumn, resetColumns, ready };
}
