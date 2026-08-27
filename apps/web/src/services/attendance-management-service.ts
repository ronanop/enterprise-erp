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

/** Local calendar date (avoids UTC shift from toISOString). */
function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocationFromNotes(notes: string): string {
  if (!notes) return "";
  const locMatch = notes.match(/Location:\s*(.+)$/i);
  if (locMatch?.[1]) return locMatch[1].trim();
  if (notes.includes("·")) {
    const parts = notes.split("·").map((p) => p.trim());
    const last = parts[parts.length - 1];
    if (last && !/on approved leave/i.test(last) && !/^WFH/i.test(last)) return last;
  }
  return "";
}

function inferDisplayStatus(
  apiStatus: string,
  checkIn: string,
  notes: string,
): AttendanceStatusCode {
  const raw = (apiStatus || "present").toLowerCase();
  if (raw === "week_off") return "weekend";
  const base = raw as AttendanceStatusCode;
  if (base === "absent" && /leave/i.test(notes)) return "leave";
  if (base !== "present") return base;
  if (/late arrival/i.test(notes)) return "late";
  if (checkIn) {
    const t = new Date(checkIn);
    if (!Number.isNaN(t.getTime()) && (t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() >= 30))) {
      return "late";
    }
  }
  return base;
}

async function listAllRows(apiPath: string): Promise<HrRow[]> {
  const all: HrRow[] = [];
  for (let page = 1; page <= 30; page += 1) {
    const res = await resourceService.list(apiPath, { page, page_size: 200 }).catch(() => ({ data: [] }));
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all;
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

/** Build a readable audit trail from attendance rows when local audit log is empty. */
export function deriveAttendanceAudit(records: AttendanceRecord[]): AttendanceAuditEntry[] {
  const stored = listAttendanceAudit();
  if (stored.length > 0) return stored;
  return [...records]
    .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
    .slice(0, 80)
    .map((r) => ({
      id: `derived-${r.id}`,
      attendanceId: r.id,
      action: r.recordStatus === "adjusted" ? "adjusted" : "recorded",
      detail: `${r.extension.employeeName} (${r.extension.employeeCode}) · ${r.attendanceDate} · ${r.status}${
        r.checkIn ? ` · in ${new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""
      }${r.checkOut ? ` · out ${new Date(r.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`,
      actor: r.source || "system",
      at: `${r.attendanceDate}T12:00:00`,
    }));
}

export function listCorrections(employeeId?: string): AttendanceCorrection[] {
  const all = readJson<AttendanceCorrection[]>(CORRECTIONS_KEY, []);
  return employeeId ? all.filter((c) => c.employeeId === employeeId) : all;
}

export async function submitCorrection(
  payload: Omit<AttendanceCorrection, "id" | "createdAt" | "workflowStage" | "createdBy">,
): Promise<AttendanceCorrection> {
  const item: AttendanceCorrection = {
    ...payload,
    id: crypto.randomUUID(),
    workflowStage: "manager",
    createdBy: actorLabel(),
    createdAt: new Date().toISOString(),
  };

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const branchId =
      typeof window !== "undefined"
        ? (JSON.parse(localStorage.getItem("erp_ats_api_context_v1") || "{}") as { branchId?: string })
            .branchId
        : undefined;
    // Prefer org context from employee directory if present
    const orgCtx =
      typeof window !== "undefined"
        ? (JSON.parse(localStorage.getItem("erp_org_context_v1") || "{}") as { branchId?: string })
        : {};
    const bid = branchId || orgCtx.branchId;
    if (bid && uuidRe.test(payload.employeeId)) {
      const field =
        payload.field === "check_out"
          ? "check_out"
          : payload.field === "attendance_status"
            ? "attendance_status"
            : "check_in";
      const res = await resourceService.create<Record<string, unknown>>("/hr/attendance-corrections", {
        branch_id: bid,
        employee_id: payload.employeeId,
        attendance_id: uuidRe.test(payload.attendanceId) ? payload.attendanceId : null,
        attendance_date: payload.date,
        field_name: field,
        old_value: payload.oldTime || null,
        new_value: payload.newTime || "",
        reason: payload.reason || null,
        status: field === "attendance_status" ? "approved" : "submitted",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) item.id = apiId;
    }
  } catch (err) {
    console.warn("Attendance correction API failed; local cache kept", err);
  }

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
    case "weekend":
      return "week_off";
    case "leave":
      return "absent";
    case "late":
    case "early_exit":
      return "present";
    case "missed_punch":
      return "miss_punch";
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
  savedOverride: boolean,
): AttendanceRecord {
  const id = String(row.id);
  const employeeId = String(row.employee_id);
  const emp = empMap.get(employeeId);
  const date = String(row.attendance_date ?? "");
  const checkIn = String(row.check_in_at ?? "");
  const checkOut = String(row.check_out_at ?? "");
  const notes = String(row.notes ?? "");
  const breakMin = ext.breakMinutes || (checkIn && checkOut ? 30 : 0);
  const totalHoursRaw = row.total_hours;
  const working =
    totalHoursRaw !== null && totalHoursRaw !== undefined && totalHoursRaw !== ""
      ? Number(totalHoursRaw)
      : diffHours(checkIn, checkOut, breakMin);
  const ot = computeOvertime(Number.isFinite(working) ? working : 0);
  const apiStatus = String(row.attendance_status ?? "");
  const displayStatus = savedOverride
    ? ext.displayStatus || inferDisplayStatus(apiStatus, checkIn, notes)
    : inferDisplayStatus(apiStatus, checkIn, notes);
  const location = ext.location || parseLocationFromNotes(notes) || (checkIn ? "HQ Office" : "");

  return {
    id,
    employeeId,
    branchId: String(row.branch_id ?? ""),
    shiftId: String(row.shift_id ?? ""),
    attendanceDate: date,
    checkIn,
    checkOut,
    workingHours: Math.round((Number.isFinite(working) ? working : 0) * 100) / 100,
    breakTime: breakMin,
    overtimeHours: Math.round(ot.total * 100) / 100,
    status: displayStatus,
    apiStatus,
    location,
    device: ext.device || String(row.source ?? ""),
    source: ext.sourceDetail || String(row.source ?? "manual"),
    approvalStatus: ext.approvalStatus,
    recordStatus: String(row.status ?? "recorded"),
    version: Number(row.version ?? 1),
    notes,
    extension: {
      ...ext,
      displayStatus,
      breakMinutes: breakMin,
      location,
      isLate: displayStatus === "late" || ext.isLate,
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
  const [attRows, empDir, branchRows, departmentRows, shiftRowsRaw] = await Promise.all([
    listAllRows("/hr/attendance"),
    loadEmployeeDirectory().catch(() => ({
      records: [],
      options: { branches: [], departments: [], designations: [], managers: [], shifts: [] },
      errors: [],
    })),
    listAllRows("/branches"),
    listAllRows("/departments"),
    listAllRows("/hr/shifts"),
  ]);

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

  const shiftMap = new Map(
    shiftRowsRaw.map((s) => [String(s.id), String(s.shift_name ?? s.shift_code ?? s.id)]),
  );

  const asOpts = (arr: HrRow[], labelKeys: string[]) =>
    arr.map((r) => ({
      id: String(r.id),
      label: String(labelKeys.map((k) => r[k]).find(Boolean) ?? r.id),
    }));

  const records = attRows
    .map((row) => {
      const id = String(row.id);
      const emp = empMap.get(String(row.employee_id));
      const saved = extensions[id];
      const notes = String(row.notes ?? "");
      const ext =
        saved ??
        defaultExtension({
          displayStatus: inferDisplayStatus(
            String(row.attendance_status ?? ""),
            String(row.check_in_at ?? ""),
            notes,
          ),
          location: parseLocationFromNotes(notes),
          device: String(row.source ?? ""),
          employeeName: emp?.name,
          employeeCode: emp?.code,
          departmentName: emp?.dept,
          departmentId: emp?.deptId,
          designationName: emp?.desig,
          managerName: emp?.manager,
          sourceDetail: String(row.source ?? "manual") as AttendanceSource,
          breakMinutes: row.check_in_at && row.check_out_at ? 30 : 0,
          approvalStatus: "approved",
        });
      return mergeRow(row, empMap, shiftMap, ext, Boolean(saved));
    })
    .sort((a, b) => {
      const byDate = b.attendanceDate.localeCompare(a.attendanceDate);
      if (byDate !== 0) return byDate;
      return a.extension.employeeName.localeCompare(b.extension.employeeName);
    });

  return {
    records,
    options: {
      branches: asOpts(branchRows, ["branch_name", "name", "branch_code"]),
      departments: asOpts(departmentRows, ["department_name", "name", "department_code"]),
      shifts: asOpts(shiftRowsRaw, ["shift_name", "shift_code"]),
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
  statsBucket: AttendanceStatBucket | null = null,
): AttendanceRecord[] {
  const q = query.trim().toLowerCase();
  const today = todayIso();
  return records.filter((r) => {
    if (statsBucket && !matchesAttendanceStatBucket(r, statsBucket, today)) return false;
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.shiftId && r.shiftId !== filters.shiftId) return false;
    if (!statsBucket && filters.status && r.status !== filters.status) return false;
    if (filters.dateFrom && r.attendanceDate < filters.dateFrom) return false;
    if (filters.dateTo && r.attendanceDate > filters.dateTo) return false;
    if (filters.location && !r.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
    if (filters.employeeId && r.employeeId !== filters.employeeId) return false;
    if (filters.departmentId && r.extension.departmentId !== filters.departmentId) return false;
    if (filters.designation && r.extension.designationName !== filters.designation) return false;
    if (filters.managerId && !r.extension.managerName) return false;
    if (!q) return true;
    const hay = [
      r.extension.employeeName,
      r.extension.employeeCode,
      r.extension.departmentName,
      r.status,
      r.location,
      r.attendanceDate,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type AttendanceStatBucket = "present" | "absent" | "late" | "missing";

export function matchesAttendanceStatBucket(
  record: AttendanceRecord,
  bucket: AttendanceStatBucket,
  date: string,
): boolean {
  if (record.attendanceDate !== date) return false;
  switch (bucket) {
    case "present":
      return record.status === "present" || record.status === "late";
    case "absent":
      return record.status === "absent";
    case "late":
      return record.status === "late" || record.extension.isLate;
    case "missing":
      return record.status === "missed_punch" || record.extension.missedPunch;
    default:
      return false;
  }
}

export function computeDashboardStats(
  records: AttendanceRecord[],
  date: string,
): Record<AttendanceStatBucket, number> {
  return {
    present: records.filter((r) => matchesAttendanceStatBucket(r, "present", date)).length,
    absent: records.filter((r) => matchesAttendanceStatBucket(r, "absent", date)).length,
    late: records.filter((r) => matchesAttendanceStatBucket(r, "late", date)).length,
    missing: records.filter((r) => matchesAttendanceStatBucket(r, "missing", date)).length,
  };
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
    absent: records.filter((r) => r.status === "absent" || r.status === "leave").length,
    late: records.filter((r) => r.status === "late" || r.extension.isLate).length,
    missing: records.filter((r) => r.status === "missed_punch").length,
    ot: records.reduce((s, r) => s + r.overtimeHours, 0),
  };
}

export async function importAttendanceCsv(
  csvText: string,
  directory: AttendanceDirectory,
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { created: 0, skipped: 0, errors: ["CSV has no data rows"] };

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (name: string) => header.indexOf(name);

  const codeIdx = idx("employee_code");
  const dateIdx = idx("attendance_date");
  const inIdx = idx("check_in");
  const outIdx = idx("check_out");
  const statusIdx = idx("status");
  const sourceIdx = idx("source");
  if (codeIdx < 0 || dateIdx < 0) {
    return { created: 0, skipped: 0, errors: ["Required columns: employee_code, attendance_date"] };
  }

  const byCode = new Map(directory.options.employees.map((e) => [e.code.toLowerCase(), e]));
  const existing = new Set(directory.records.map((r) => `${r.employeeId}|${r.attendanceDate}`));
  const branchId = directory.options.branches[0]?.id ?? "";
  const shiftId = directory.options.shifts[0]?.id ?? "";

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const code = (cols[codeIdx] ?? "").trim();
    const date = (cols[dateIdx] ?? "").trim();
    const emp = byCode.get(code.toLowerCase());
    if (!emp || !date) {
      errors.push(`Row ${i + 1}: unknown employee or date`);
      skipped += 1;
      continue;
    }
    if (existing.has(`${emp.id}|${date}`)) {
      skipped += 1;
      continue;
    }
    const status = ((cols[statusIdx] || "present") as AttendanceStatusCode);
    const source = ((cols[sourceIdx] || "manual") as AttendanceSource);
    try {
      await markAttendance({
        branchId,
        employeeId: emp.id,
        attendanceDate: date,
        shiftId,
        checkIn: cols[inIdx] || "",
        checkOut: cols[outIdx] || "",
        breakStart: "",
        breakEnd: "",
        status,
        location: "HQ Office",
        source,
        gpsCoordinates: "",
        notes: "Imported from CSV",
      });
      existing.add(`${emp.id}|${date}`);
      created += 1;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "failed"}`);
      skipped += 1;
    }
  }

  return { created, skipped, errors: errors.slice(0, 10) };
}

export async function applyAttendanceCorrection(input: {
  record: AttendanceRecord;
  portion: "full_day" | "first_half" | "second_half";
  reason: string;
  attachmentName: string;
}): Promise<void> {
  const { record, portion, reason, attachmentName } = input;
  const nextStatus: AttendanceStatusCode = portion === "full_day" ? "present" : "half_day";
  const portionLabel =
    portion === "full_day" ? "full day" : portion === "first_half" ? "1st half" : "2nd half";
  const noteTag = `regularized:${portion}`;
  const baseNotes = (record.notes || "")
    .replace(/\s*·?\s*regularized:(full_day|first_half|second_half)/g, "")
    .replace(/\s*·?\s*Corrected:[^·]*/g, "")
    .trim();
  const notes = [baseNotes, noteTag, reason].filter(Boolean).join(" · ");

  await resourceService.update("/hr/attendance", record.id, {
    version: record.version,
    attendance_status: mapToApiStatus(nextStatus),
    notes,
  });

  await submitCorrection({
    attendanceId: record.id,
    employeeId: record.employeeId,
    date: record.attendanceDate,
    field: "attendance_status",
    oldTime: record.status,
    newTime: nextStatus,
    reason: `${portionLabel}: ${reason}`,
    attachmentName,
    portion,
  });

  saveExtension(record.id, {
    ...record.extension,
    displayStatus: nextStatus,
    approvalStatus: "approved",
  });

  appendAttendanceAudit({
    attendanceId: record.id,
    action: "regularized",
    detail: `${record.status} → ${nextStatus} (${portionLabel}); punches unchanged`,
    actor: actorLabel(),
  });
}
