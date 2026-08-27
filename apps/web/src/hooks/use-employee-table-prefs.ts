"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "erp.hr.workforce.tablePrefs.v3";

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
  | "personalEmail"
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

/** Columns shown by default (aligned with workforce Excel fields). */
export const DEFAULT_EMPLOYEE_TABLE_COLUMNS: EmployeeTableColumnKey[] = [
  "employeeCode",
  "name",
  "entity",
  "organisation",
  "location",
  "designation",
  "department",
  "reportingManager",
  "joiningDate",
  "personalEmail",
  "email",
  "gender",
  "dob",
  "status",
];

/** Always visible — cannot be hidden. */
export const REQUIRED_EMPLOYEE_TABLE_COLUMNS: EmployeeTableColumnKey[] = [
  "employeeCode",
  "name",
];

export const EMPLOYEE_TABLE_COLUMN_LABELS: Record<EmployeeTableColumnKey, string> = {
  employeeCode: "EMPLOYEE ID",
  name: "NAME",
  entity: "Entity",
  organisation: "Organisation",
  branch: "Branch",
  location: "Base Location",
  designation: "Designation",
  department: "Department",
  reportingManager: "Reporting Manager",
  employmentType: "Type",
  gender: "Gender",
  email: "cache email id",
  personalEmail: "Email id",
  phone: "Emp. Contact No.",
  grade: "Grade",
  jobLevel: "Job Level",
  shift: "Shift",
  legalEntity: "Legal Entity",
  managementGroup: "Management Group",
  leavePolicy: "Leave Policy",
  dob: "DOB",
  maritalStatus: "Marital Status",
  joiningDate: "DOJ",
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
