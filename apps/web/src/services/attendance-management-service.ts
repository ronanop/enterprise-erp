import { resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { HrRow } from "@/services/hr-service";
import type {
  AttendanceAuditEntry,
  AttendanceCorrection,
  AttendanceExtension,
  AttendanceFilters,
  AttendanceRecord,
  AttendanceSource,
  AttendanceStatusCode,
  MarkAttendancePayload,
} from "@/types/attendance-management";

const EXT_KEY = "erp_attendance_extensions_v1";
const AUDIT_KEY = "erp_attendance_audit_v1";
const CORRECTIONS_KEY = "erp_attendance_corrections_v1";

const NORMAL_HOURS = 8;
const DOUBLE_OT_THRESHOLD = 12;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function actorLabel(): string {
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; full_name?: string };
      return p.full_name || p.email || "HR User";
    }
  } catch {
    /* ignore */
  }
  return "HR User";
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadExtensions(): Record<string, AttendanceExtension> {
  return readJson<Record<string, AttendanceExtension>>(EXT_KEY, {});
}

function saveExtension(id: string, ext: AttendanceExtension): void {
  const all = loadExtensions();
  all[id] = ext;
  writeJson(EXT_KEY, all);
}

export function appendAttendanceAudit(entry: Omit<AttendanceAuditEntry, "id" | "at">): void {
  const all = readJson<AttendanceAuditEntry[]>(AUDIT_KEY, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  writeJson(AUDIT_KEY, all.slice(0, 5000));
}

export function listAttendanceAudit(attendanceId?: string): AttendanceAuditEntry[] {
  const all = readJson<AttendanceAuditEntry[]>(AUDIT_KEY, []);
  return attendanceId ? all.filter((a) => a.attendanceId === attendanceId) : all;
}

export function listCorrections(employeeId?: string): AttendanceCorrection[] {
  const all = readJson<AttendanceCorrection[]>(CORRECTIONS_KEY, []);
  return employeeId ? all.filter((c) => c.employeeId === employeeId) : all;
}

export function submitCorrection(
  payload: Omit<AttendanceCorrection, "id" | "createdAt" | "workflowStage" | "createdBy">,
): AttendanceCorrection {
  const item: AttendanceCorrection = {
    ...payload,
    id: crypto.randomUUID(),
    workflowStage: "manager",
    createdBy: actorLabel(),
    createdAt: new Date().toISOString(),
  };
  const all = readJson<AttendanceCorrection[]>(CORRECTIONS_KEY, []);
  all.unshift(item);
  writeJson(CORRECTIONS_KEY, all);
  appendAttendanceAudit({
    attendanceId: payload.attendanceId,
    action: "correction_requested",
    detail: `${payload.field}: ${payload.oldTime} → ${payload.newTime}`,
    actor: actorLabel(),
  });
  return item;
}

export function mapToApiStatus(status: AttendanceStatusCode): string {
  switch (status) {
    case "leave":
    case "weekend":
    case "late":
    case "early_exit":
    case "missed_punch":
      return status === "leave" ? "absent" : status === "weekend" ? "holiday" : "present";
    default:
      return status;
  }
}

export function mapToApiSource(source: AttendanceSource): string {
  if (source === "qr" || source === "face_recognition") return "device";
  if (source === "manual") return "manual";
  if (source === "biometric") return "biometric";
  if (source === "mobile") return "mobile";
  return "web";
}

function parseTimeOnDate(date: string, time: string): string | null {
  if (!time) return null;
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}`;
}

function diffHours(checkIn: string, checkOut: string, breakMinutes: number): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.max(0, (b - a) / 3_600_000 - breakMinutes / 60);
}

export function computeOvertime(workingHours: number): { normal: number; double: number; total: number } {
  if (workingHours <= NORMAL_HOURS) return { normal: 0, double: 0, total: 0 };
  const total = workingHours - NORMAL_HOURS;
  if (workingHours <= DOUBLE_OT_THRESHOLD) return { normal: total, double: 0, total };
  const double = workingHours - DOUBLE_OT_THRESHOLD;
  const normal = DOUBLE_OT_THRESHOLD - NORMAL_HOURS;
  return { normal, double, total: normal + double };
}

function defaultExtension(partial?: Partial<AttendanceExtension>): AttendanceExtension {
  return {
    displayStatus: partial?.displayStatus ?? "present",
    breakStart: partial?.breakStart ?? "",
    breakEnd: partial?.breakEnd ?? "",
    breakMinutes: partial?.breakMinutes ?? 0,
    location: partial?.location ?? "",
    device: partial?.device ?? "",
    gpsCoordinates: partial?.gpsCoordinates ?? "",
    sourceDetail: partial?.sourceDetail ?? "manual",
    approvalStatus: partial?.approvalStatus ?? "approved",
    overtimeNormal: partial?.overtimeNormal ?? 0,
    overtimeDouble: partial?.overtimeDouble ?? 0,
    isLate: partial?.isLate ?? false,
    isEarlyExit: partial?.isEarlyExit ?? false,
    missedPunch: partial?.missedPunch ?? false,
    departmentName: partial?.departmentName ?? "—",
    departmentId: partial?.departmentId ?? "",
    designationName: partial?.designationName ?? "—",
    employeeCode: partial?.employeeCode ?? "",
    employeeName: partial?.employeeName ?? "",
    shiftName: partial?.shiftName ?? "—",
    managerName: partial?.managerName ?? "—",
  };
}

function mergeRow(
  row: HrRow,
  empMap: Map<string, { name: string; code: string; dept: string; deptId: string; desig: string; manager: string }>,
  shiftMap: Map<string, string>,
  ext: AttendanceExtension,
): AttendanceRecord {
  const id = String(row.id);
  const employeeId = String(row.employee_id);
  const emp = empMap.get(employeeId);
  const date = String(row.attendance_date ?? "");
  const checkIn = String(row.check_in_at ?? "");
  const checkOut = String(row.check_out_at ?? "");
  const breakMin = ext.breakMinutes || 0;
  const working =
    typeof row.total_hours === "number"
      ? Number(row.total_hours)
      : diffHours(checkIn, checkOut, breakMin);
  const ot = computeOvertime(working);
  const displayStatus = ext.displayStatus || (String(row.attendance_status) as AttendanceStatusCode);

  return {
    id,
    employeeId,
    branchId: String(row.branch_id ?? ""),
    shiftId: String(row.shift_id ?? ""),
    attendanceDate: date,
    checkIn,
    checkOut,
    workingHours: Math.round(working * 100) / 100,
    breakTime: breakMin,
    overtimeHours: Math.round(ot.total * 100) / 100,
    status: displayStatus,
    apiStatus: String(row.attendance_status ?? ""),
    location: ext.location,
    device: ext.device || String(row.source ?? ""),
    source: ext.sourceDetail || String(row.source ?? "manual"),
    approvalStatus: ext.approvalStatus,
    recordStatus: String(row.status ?? "recorded"),
    version: Number(row.version ?? 1),
    notes: String(row.notes ?? ""),
    extension: {
      ...ext,
      employeeName: emp?.name ?? ext.employeeName,
      employeeCode: emp?.code ?? ext.employeeCode,
      departmentName: emp?.dept ?? ext.departmentName,
      departmentId: emp?.deptId ?? ext.departmentId,
      designationName: emp?.desig ?? ext.designationName,
      managerName: emp?.manager ?? ext.managerName,
      shiftName: shiftMap.get(String(row.shift_id ?? "")) ?? ext.shiftName,
      overtimeNormal: ot.normal,
      overtimeDouble: ot.double,
    },
  };
}

export type AttendanceDirectory = {
  records: AttendanceRecord[];
  options: {
    branches: { id: string; label: string }[];
    departments: { id: string; label: string }[];
    shifts: { id: string; label: string }[];
    managers: { id: string; label: string }[];
    employees: { id: string; label: string; code: string; departmentId: string; designation: string; managerId: string }[];
  };
};

export async function loadAttendanceDirectory(): Promise<AttendanceDirectory> {
  const [attRes, empDir, branches, departments, shifts] = await Promise.all([
    resourceService.list("/hr/attendance").catch(() => ({ data: [] })),
    loadEmployeeDirectory().catch(() => ({ records: [], options: { branches: [], departments: [], designations: [], managers: [], shifts: [] }, errors: [] })),
    resourceService.list("/branches").catch(() => ({ data: [] })),
    resourceService.list("/departments").catch(() => ({ data: [] })),
    resourceService.list("/hr/shifts").catch(() => ({ data: [] })),
  ]);

  const rows = (Array.isArray(attRes.data) ? attRes.data : []) as HrRow[];
  const extensions = loadExtensions();

  const empMap = new Map<
    string,
    { name: string; code: string; dept: string; deptId: string; desig: string; manager: string }
  >();
  for (const e of empDir.records) {
    empMap.set(e.id, {
      name: e.displayName,
      code: e.employeeCode,
      dept: e.departmentName,
      deptId: e.departmentId,
      desig: e.designationName,
      manager: e.reportingManagerName,
    });
  }

  const shiftRows = (Array.isArray(shifts.data) ? shifts.data : []) as HrRow[];
  const shiftMap = new Map(
    shiftRows.map((s) => [String(s.id), String(s.shift_name ?? s.shift_code ?? s.id)]),
  );

  const asOpts = (d: unknown, labelKeys: string[]) => {
    const arr = (Array.isArray(d) ? d : []) as HrRow[];
    return arr.map((r) => ({
      id: String(r.id),
      label: String(labelKeys.map((k) => r[k]).find(Boolean) ?? r.id),
    }));
  };

  const records = rows.map((row) => {
    const id = String(row.id);
    const emp = empMap.get(String(row.employee_id));
    const ext = extensions[id] ?? defaultExtension({
      displayStatus: String(row.attendance_status) as AttendanceStatusCode,
      employeeName: emp?.name,
      employeeCode: emp?.code,
      departmentName: emp?.dept,
      designationName: emp?.desig,
      managerName: emp?.manager,
      sourceDetail: String(row.source ?? "manual") as AttendanceSource,
    });
    return mergeRow(row, empMap, shiftMap, ext);
  });

  return {
    records,
    options: {
      branches: asOpts(branches.data, ["branch_name", "name", "branch_code"]),
      departments: asOpts(departments.data, ["department_name", "name", "department_code"]),
      shifts: asOpts(shifts.data, ["shift_name", "shift_code"]),
      managers: empDir.options.managers,
      employees: empDir.records.map((e) => ({
        id: e.id,
        label: e.displayName,
        code: e.employeeCode,
        departmentId: e.departmentId,
        designation: e.designationName,
        managerId: e.reportingManagerId,
      })),
    },
  };
}

export function filterAttendanceRecords(
  records: AttendanceRecord[],
  query: string,
  filters: AttendanceFilters,
): AttendanceRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((r) => {
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.shiftId && r.shiftId !== filters.shiftId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.dateFrom && r.attendanceDate < filters.dateFrom) return false;
    if (filters.dateTo && r.attendanceDate > filters.dateTo) return false;
    if (filters.location && !r.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
    if (filters.departmentId && r.extension.departmentId !== filters.departmentId) return false;
    if (filters.designation && r.extension.designationName !== filters.designation) return false;
    if (filters.managerId) {
      const mgr = r.extension.managerName;
      if (!mgr) return false;
    }
    if (!q) return true;
    const hay = [r.extension.employeeName, r.extension.employeeCode, r.extension.departmentName, r.status]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function computeDashboardStats(records: AttendanceRecord[], date: string) {
  const today = records.filter((r) => r.attendanceDate === date);
  const present = today.filter((r) => ["present", "late"].includes(r.status)).length;
  const absent = today.filter((r) => r.status === "absent").length;
  const late = today.filter((r) => r.status === "late" || r.extension.isLate).length;
  const half = today.filter((r) => r.status === "half_day").length;
  const wfh = today.filter((r) => r.status === "work_from_home").length;
  const leave = today.filter((r) => r.status === "leave").length;
  const otHours = today.reduce((s, r) => s + r.overtimeHours, 0);
  const missing = today.filter((r) => r.status === "missed_punch" || r.extension.missedPunch).length;
  return { present, absent, late, half, wfh, leave, otHours: Math.round(otHours * 10) / 10, missing };
}

export async function markAttendance(payload: MarkAttendancePayload): Promise<void> {
  const breakMinutes =
    payload.breakStart && payload.breakEnd
      ? diffHours(
          parseTimeOnDate(payload.attendanceDate, payload.breakStart) ?? "",
          parseTimeOnDate(payload.attendanceDate, payload.breakEnd) ?? "",
          0,
        ) * 60
      : 0;

  const checkInIso = parseTimeOnDate(payload.attendanceDate, payload.checkIn);
  const checkOutIso = parseTimeOnDate(payload.attendanceDate, payload.checkOut);
  const working = diffHours(checkInIso ?? "", checkOutIso ?? "", breakMinutes);
  const ot = computeOvertime(working);

  const res = await resourceService.create("/hr/attendance", {
    branch_id: payload.branchId,
    employee_id: payload.employeeId,
    attendance_date: payload.attendanceDate,
    attendance_status: mapToApiStatus(payload.status),
    source: mapToApiSource(payload.source),
    shift_id: payload.shiftId || null,
    check_in_at: checkInIso,
    check_out_at: checkOutIso,
    total_hours: working > 0 ? working : null,
    notes: payload.notes || null,
  });

  const row = res.data as HrRow;
  const id = String(row.id);

  saveExtension(
    id,
    defaultExtension({
      displayStatus: payload.status,
      breakStart: payload.breakStart,
      breakEnd: payload.breakEnd,
      breakMinutes: Math.round(breakMinutes),
      location: payload.location,
      device: payload.source,
      gpsCoordinates: payload.gpsCoordinates,
      sourceDetail: payload.source,
      approvalStatus: payload.source === "manual" ? "approved" : "pending",
      overtimeNormal: ot.normal,
      overtimeDouble: ot.double,
      isLate: payload.status === "late",
      isEarlyExit: payload.status === "early_exit",
      missedPunch: payload.status === "missed_punch",
    }),
  );

  appendAttendanceAudit({
    attendanceId: id,
    action: "marked",
    detail: `${payload.status} on ${payload.attendanceDate}`,
    actor: actorLabel(),
  });
}

export async function bulkUpdateAttendanceStatus(
  records: AttendanceRecord[],
  status: AttendanceStatusCode,
): Promise<void> {
  for (const r of records) {
    await resourceService.update("/hr/attendance", r.id, {
      version: r.version,
      attendance_status: mapToApiStatus(status),
    });
    saveExtension(r.id, {
      ...r.extension,
      displayStatus: status,
    });
    appendAttendanceAudit({
      attendanceId: r.id,
      action: "bulk_update",
      detail: `Status → ${status}`,
      actor: actorLabel(),
    });
  }
}

export function exportAttendanceCsv(records: AttendanceRecord[]): string {
  const headers = [
    "Date",
    "Employee ID",
    "Employee",
    "Department",
    "Shift",
    "Check In",
    "Check Out",
    "Working Hours",
    "Break",
    "Overtime",
    "Status",
    "Location",
    "Source",
    "Approval",
  ];
  const lines = records.map((r) =>
    [
      r.attendanceDate,
      r.extension.employeeCode,
      r.extension.employeeName,
      r.extension.departmentName,
      r.extension.shiftName,
      r.checkIn,
      r.checkOut,
      r.workingHours,
      r.breakTime,
      r.overtimeHours,
      r.status,
      r.location,
      r.source,
      r.approvalStatus,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export { todayIso };

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function groupByDate(records: AttendanceRecord[]): Map<string, AttendanceRecord[]> {
  const map = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const list = map.get(r.attendanceDate) ?? [];
    list.push(r);
    map.set(r.attendanceDate, list);
  }
  return map;
}

export function reportSummary(records: AttendanceRecord[], label: string) {
  return {
    label,
    total: records.length,
    present: records.filter((r) => r.status === "present" || r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    late: records.filter((r) => r.status === "late" || r.extension.isLate).length,
    missing: records.filter((r) => r.status === "missed_punch").length,
    ot: records.reduce((s, r) => s + r.overtimeHours, 0),
  };
}
