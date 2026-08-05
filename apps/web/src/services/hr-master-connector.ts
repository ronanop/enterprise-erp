/**
 * Shared HR master connector — single source of truth for employees, shifts,
 * salary structures, departments, and branches across HRMS modules.
 */

import {
  loadEmployeeDirectory,
  type EmployeeDirectoryOptions,
} from "@/services/employee-management-service";
import type { EmployeeRecord } from "@/types/employee-management";
import {
  consumeEmployeeSequence,
  formatEmployeeCode,
} from "@/config/employee-id";
import {
  emptyBank,
  emptyEmployment,
  emptyGovernmentIds,
  emptyPersonal,
  emptySalary,
} from "@/types/employee-management";

const LOCAL_EMP_KEY = "erp_hr_local_employees_v1";

export type HrMasterOption = {
  id: string;
  label: string;
  code?: string;
  department?: string;
  departmentId?: string;
  branchId?: string;
  branchName?: string;
  headEmployeeId?: string;
  shiftId?: string;
  shiftName?: string;
  bankAccount?: string;
  monthlyCtc?: number;
  email?: string;
};

export type HrMasterDirectory = {
  employees: HrMasterOption[];
  records: EmployeeRecord[];
  departments: HrMasterOption[];
  branches: HrMasterOption[];
  designations: HrMasterOption[];
  managers: HrMasterOption[];
  shifts: HrMasterOption[];
  salaryStructures: HrMasterOption[];
  leaveTypes: HrMasterOption[];
  errors: string[];
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function recordToOption(r: EmployeeRecord): HrMasterOption {
  const sal = r.extension?.salary;
  return {
    id: r.id,
    label: `${r.displayName} · ${r.employeeCode}`,
    code: r.employeeCode,
    department: r.departmentName,
    departmentId: r.departmentId,
    branchId: r.branchId,
    branchName: r.branchName,
    shiftId: r.extension?.employment?.shiftId,
    shiftName: r.extension?.employment?.shiftName,
    bankAccount: r.extension?.bank?.accountNumber
      ? `XXXX${String(r.extension.bank.accountNumber).slice(-4)}`
      : undefined,
    monthlyCtc: sal?.ctc ? Number(sal.ctc) || undefined : undefined,
    email: r.officialEmail,
  };
}

/** Local employees created by onboarding activation (merged into directory). */
export function listLocalEmployees(): EmployeeRecord[] {
  return readJson<EmployeeRecord[]>(LOCAL_EMP_KEY, []);
}

export function registerLocalEmployee(
  input: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    department?: string;
    designation?: string;
    branch?: string;
    shift?: string;
    leavePolicy?: string;
    employmentType?: string;
    reportingManager?: string;
    joiningDate?: string;
    employeeCode?: string;
  },
): EmployeeRecord {
  const seq = consumeEmployeeSequence();
  const code = input.employeeCode || formatEmployeeCode(seq);
  const id = crypto.randomUUID();
  const displayName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  const personal = emptyPersonal();
  personal.firstName = input.firstName;
  personal.lastName = input.lastName ?? "";
  personal.officialEmail = input.email;
  personal.mobile = input.phone ?? "";

  const employment = emptyEmployment();
  employment.employeeCode = code;
  employment.departmentName = input.department ?? "General";
  employment.designationName = input.designation ?? "Associate";
  employment.branchName = input.branch ?? "Head Office";
  employment.shiftName = input.shift ?? "General";
  employment.leavePolicyName = input.leavePolicy ?? "Standard";
  employment.employmentType = input.employmentType ?? "full_time";
  employment.reportingManagerName = input.reportingManager ?? "";
  employment.joiningDate = input.joiningDate ?? new Date().toISOString().slice(0, 10);
  employment.lifecycleStatus = "probation";

  const record: EmployeeRecord = {
    id,
    masterVersion: 1,
    employeeCode: code,
    displayName: displayName || code,
    officialEmail: input.email,
    mobile: input.phone ?? "",
    departmentId: "",
    departmentName: employment.departmentName,
    designationName: employment.designationName,
    branchId: "",
    branchName: employment.branchName,
    reportingManagerId: "",
    reportingManagerName: employment.reportingManagerName,
    employmentType: employment.employmentType,
    joiningDate: employment.joiningDate,
    lifecycleStatus: "probation",
    gender: "",
    isDeleted: false,
    extension: {
      personal,
      employment,
      governmentIds: emptyGovernmentIds(),
      bank: emptyBank(),
      companyBank: emptyBank(),
      salary: emptySalary(),
      documents: [],
      education: [],
      previousEmployment: [],
      createdBy: "Onboarding",
      updatedBy: "Onboarding",
      updatedAt: new Date().toISOString(),
    },
  };

  const all = listLocalEmployees().filter((e) => e.employeeCode !== code);
  all.unshift(record);
  writeJson(LOCAL_EMP_KEY, all.slice(0, 2000));
  return record;
}

export function resolveEmployeeOption(
  employees: HrMasterOption[],
  idOrCode: string,
): HrMasterOption | undefined {
  return employees.find(
    (e) => e.id === idOrCode || e.code === idOrCode || e.label === idOrCode,
  );
}

export function getAssignedShiftId(
  employeeId: string,
  date?: string,
): string | undefined {
  const assignments = readJson<
    { employeeId?: string; employee_id?: string; shiftId?: string; shift_id?: string; effectiveFrom?: string; effective_from?: string; effectiveTo?: string; effective_to?: string }[]
  >("erp_roster_local_assignments_v1", []);

  // Also check shift roster assign extensions path used by roster service
  const rosterAssign = readJson<
    { employeeId: string; shiftId: string; effectiveFrom: string; effectiveTo?: string }[]
  >("erp_shift_roster_assignments_cache_v1", []);

  const day = date ?? new Date().toISOString().slice(0, 10);
  const pool = [
    ...assignments.map((a) => ({
      employeeId: String(a.employeeId ?? a.employee_id ?? ""),
      shiftId: String(a.shiftId ?? a.shift_id ?? ""),
      from: String(a.effectiveFrom ?? a.effective_from ?? ""),
      to: String(a.effectiveTo ?? a.effective_to ?? ""),
    })),
    ...rosterAssign.map((a) => ({
      employeeId: a.employeeId,
      shiftId: a.shiftId,
      from: a.effectiveFrom,
      to: a.effectiveTo ?? "",
    })),
  ];

  const hit = pool.find((a) => {
    if (a.employeeId !== employeeId || !a.shiftId) return false;
    if (a.from && day < a.from) return false;
    if (a.to && day > a.to) return false;
    return true;
  });
  return hit?.shiftId;
}

/** Cache roster assignments for attendance shift prefill. */
export function cacheRosterAssignments(
  rows: { employeeId: string; shiftId: string; effectiveFrom: string; effectiveTo?: string }[],
): void {
  writeJson("erp_shift_roster_assignments_cache_v1", rows.slice(0, 5000));
}

export function listSalaryStructureOptions(): HrMasterOption[] {
  const structures = readJson<{ id: string; name: string; basic?: number }[]>(
    "erp_pay_structures_v1",
    [],
  );
  return structures.map((s) => ({
    id: s.id,
    label: s.name,
    code: s.id,
    monthlyCtc: s.basic,
  }));
}

export async function loadHrMasterDirectory(): Promise<HrMasterDirectory> {
  let records: EmployeeRecord[] = [];
  let options: EmployeeDirectoryOptions = {
    branches: [],
    departments: [],
    designations: [],
    managers: [],
    managementGroups: [],
    shifts: [],
  };
  const errors: string[] = [];

  try {
    const dir = await loadEmployeeDirectory();
    records = dir.records;
    options = dir.options;
    errors.push(...dir.errors);
  } catch {
    errors.push("Could not load employee directory");
  }

  const local = listLocalEmployees();
  const seen = new Set(records.map((r) => r.id));
  const seenCodes = new Set(records.map((r) => r.employeeCode));
  for (const loc of local) {
    if (seen.has(loc.id) || seenCodes.has(loc.employeeCode)) continue;
    records.push(loc);
  }

  const leaveTypes = readJson<{ id?: string; name?: string; leave_type_name?: string }[]>(
    "erp_leave_types_cache_v1",
    [],
  );

  return {
    employees: records
      .filter((r) => !r.isDeleted && r.lifecycleStatus !== "archived")
      .map(recordToOption),
    records,
    departments: options.departments.map((d) => ({
      id: d.id,
      label: d.label,
      branchId: d.branchId,
      headEmployeeId: d.headEmployeeId,
    })),
    branches: options.branches.map((b) => ({
      id: b.id,
      label: b.label,
      headEmployeeId: b.headEmployeeId,
    })),
    designations: options.designations.map((d) => ({ id: d.id, label: d.label })),
    managers: options.managers.map((m) => ({ id: m.id, label: m.label })),
    shifts: options.shifts.map((s) => ({ id: s.id, label: s.label })),
    salaryStructures: listSalaryStructureOptions(),
    leaveTypes: leaveTypes.map((t) => ({
      id: String(t.id ?? t.name ?? ""),
      label: String(t.leave_type_name ?? t.name ?? t.id ?? ""),
    })),
    errors,
  };
}
