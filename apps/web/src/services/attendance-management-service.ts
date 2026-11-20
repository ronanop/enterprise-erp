import {
  mapMachineAttendanceStatus,
  normalizeAttendanceDate,
  normalizeAttendanceTime,
} from "@/lib/attendance-import-map";
import { resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { HrRow } from "@/services/hr-service";
import { devError, devWarn } from "@/lib/dev-log";
import type {
  AttendanceAuditEntry,
  AttendanceCorrection,
  AttendanceExtension,
  AttendanceFilters,
  AttendancePunch,
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

/** Decimal hours → "5h 47m" (empty / invalid → "—"). */
export function formatHoursMinutes(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseLocationFromNotes(notes: string): string {
  if (!notes) return "";
  const locMatch = notes.match(/Location:\s*([^|]+)/i);
  if (locMatch?.[1]) return locMatch[1].trim();
  if (notes.includes("·")) {
    const parts = notes.split("·").map((p) => p.trim());
    const last = parts[parts.length - 1];
    if (last && !/on approved leave/i.test(last) && !/^WFH/i.test(last)) return last;
  }
  return "";
}

function elapsedHours(startIso: string, endIso: string, breakMinutes = 0): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.max(0, (b - a) / 3_600_000 - breakMinutes / 60);
}

/** Hours from first punch-in to checkout, or to now when the day is still open. */
export function hoursFromFirstPunch(
  punches: AttendancePunch[],
  checkIn: string,
  checkOut: string,
  attendanceDate: string,
  breakMinutes = 0,
): number {
  const first = punches[0]?.punchedAt || checkIn;
  if (!first) return 0;
  const today = todayIso();
  let endIso = checkOut;
  if (!endIso) {
    if (attendanceDate === today) endIso = new Date().toISOString();
    else if (punches.length > 1) endIso = punches[punches.length - 1]?.punchedAt || "";
    else return 0;
  }
  if (!endIso) return 0;
  return Math.round(elapsedHours(first, endIso, breakMinutes) * 100) / 100;
}

function inferDisplayStatus(
  apiStatus: string,
  _checkIn: string,
  notes: string,
): AttendanceStatusCode {
  // Trust API/policy status — never invent "late" from a hardcoded clock time.
  const raw = (apiStatus || "present").toLowerCase();
  if (raw === "week_off") return "weekend";
  if (raw === "miss_punch") return "missed_punch";
  const base = raw as AttendanceStatusCode;
  if (base === "absent" && /leave/i.test(notes)) return "leave";
  return base;
}

async function listAllRows(
  apiPath: string,
  query: Record<string, string | number | boolean | null | undefined> = {},
  maxPages = 30,
): Promise<HrRow[]> {
  const all: HrRow[] = [];
  const seenFirstIds = new Set<string>();
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await resourceService
      .list(apiPath, { page, page_size: 200, ...query })
      .catch(() => ({ data: [] }));
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    const firstId = rows[0] ? String(rows[0].id ?? "") : "";
    if (page > 1 && firstId && seenFirstIds.has(firstId)) break;
    if (firstId) seenFirstIds.add(firstId);
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
    devWarn("Attendance correction API failed; local cache kept");
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
  return elapsedHours(checkIn, checkOut, breakMinutes);
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
    departmentName: partial?.departmentName ?? "-",
    departmentId: partial?.departmentId ?? "",
    designationName: partial?.designationName ?? "-",
    employeeCode: partial?.employeeCode ?? "",
    employeeName: partial?.employeeName ?? "",
    shiftName: partial?.shiftName ?? "-",
    managerName: partial?.managerName ?? "-",
  };
}

type EmpLookup = Map<
  string,
  { name: string; code: string; dept: string; deptId: string; desig: string; manager: string }
>;

function mergeRow(
  row: HrRow,
  empMap: EmpLookup,
  shiftMap: Map<string, string>,
  ext: AttendanceExtension,
  savedOverride: boolean,
  punches: AttendancePunch[] = [],
): AttendanceRecord {
  const id = String(row.id);
  const employeeId = String(row.employee_id);
  const emp = empMap.get(employeeId);
  const date = String(row.attendance_date ?? "");
  const checkIn = String(row.check_in_at ?? "");
  const checkOut = String(row.check_out_at ?? "");
  const notes = String(row.notes ?? "");
  const breakMin = ext.breakMinutes || 0;
  const dayPunches =
    punches.length > 0
      ? punches
      : checkIn
        ? [
            {
              id: `${id}-in`,
              punchedAt: checkIn,
              deviceCode: "",
              deviceName: String(row.source ?? "manual"),
              deviceLocation: parseLocationFromNotes(notes),
            },
            ...(checkOut
              ? [
                  {
                    id: `${id}-out`,
                    punchedAt: checkOut,
                    deviceCode: "",
                    deviceName: String(row.source ?? "manual"),
                    deviceLocation: parseLocationFromNotes(notes),
                  },
                ]
              : []),
          ]
        : [];
  const working = hoursFromFirstPunch(dayPunches, checkIn, checkOut, date, breakMin);
  const ot = computeOvertime(Number.isFinite(working) ? working : 0);
  const apiStatus = String(row.attendance_status ?? "");
  const displayStatus = savedOverride
    ? ext.displayStatus || inferDisplayStatus(apiStatus, checkIn, notes)
    : inferDisplayStatus(apiStatus, checkIn, notes);
  const punchLocation =
    dayPunches.find((p) => p.deviceLocation)?.deviceLocation ||
    dayPunches[0]?.deviceLocation ||
    "";
  const location =
    punchLocation || ext.location || parseLocationFromNotes(notes) || "";
  const deviceLabel =
    dayPunches[0]?.deviceName ||
    dayPunches[0]?.deviceCode ||
    ext.device ||
    String(row.source ?? "");

  return {
    id,
    employeeId,
    branchId: String(row.branch_id ?? ""),
    companyId: row.company_id ? String(row.company_id) : undefined,
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
    device: deviceLabel,
    source: ext.sourceDetail || String(row.source ?? "manual"),
    approvalStatus: ext.approvalStatus,
    recordStatus: String(row.status ?? "recorded"),
    version: Number(row.version ?? 1),
    notes,
    punches: dayPunches,
    extension: {
      ...ext,
      displayStatus,
      breakMinutes: breakMin,
      location,
      device: deviceLabel,
      isLate: displayStatus === "late" || ext.isLate,
      employeeName:
        emp?.name ||
        String(row.employee_name ?? "").trim() ||
        ext.employeeName ||
        "",
      employeeCode:
        emp?.code ||
        String(row.employee_code ?? "").trim() ||
        ext.employeeCode ||
        "",
      departmentName:
        cleanDeptName(emp?.dept) ||
        cleanDeptName(String(row.department_name ?? "")) ||
        cleanDeptName(ext.departmentName),
      departmentId:
        emp?.deptId ||
        String(row.department_id ?? "").trim() ||
        ext.departmentId,
      designationName: emp?.desig ?? ext.designationName,
      managerName: emp?.manager ?? ext.managerName,
      shiftName: shiftMap.get(String(row.shift_id ?? "")) ?? ext.shiftName,
      overtimeNormal: ot.normal,
      overtimeDouble: ot.double,
    },
  };
}

function punchKey(employeeId: string, attendanceDate: string): string {
  return `${employeeId}|${attendanceDate}`;
}

function mapApiPunches(rows: HrRow[]): Map<string, AttendancePunch[]> {
  const map = new Map<string, AttendancePunch[]>();
  for (const raw of rows) {
    const employeeId = String(raw.employee_id ?? "");
    const attendanceDate = String(raw.attendance_date ?? "");
    if (!employeeId || !attendanceDate) continue;
    const punch: AttendancePunch = {
      id: String(raw.id ?? `${employeeId}-${raw.punched_at}`),
      punchedAt: String(raw.punched_at ?? ""),
      deviceCode: String(raw.device_code ?? ""),
      deviceName: String(raw.device_name ?? raw.device_code ?? ""),
      deviceLocation: String(raw.device_location ?? "").trim(),
    };
    if (!punch.punchedAt) continue;
    const key = punchKey(employeeId, attendanceDate);
    const list = map.get(key) ?? [];
    list.push(punch);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));
  }
  return map;
}

async function loadPunchesForRange(dateFrom: string, dateTo: string): Promise<Map<string, AttendancePunch[]>> {
  try {
    const res = await resourceService.list("/hr/biometric-punches", {
      date_from: dateFrom,
      date_to: dateTo,
      page_size: 5000,
      limit: 5000,
    });
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    return mapApiPunches(rows);
  } catch {
    return new Map();
  }
}

function recordsFromRows(
  attRows: HrRow[],
  empMap: EmpLookup,
  shiftMap: Map<string, string>,
  punchMap: Map<string, AttendancePunch[]> = new Map(),
): AttendanceRecord[] {
  const extensions = loadExtensions();
  return attRows
    .map((row) => {
      const id = String(row.id);
      const employeeId = String(row.employee_id);
      const date = String(row.attendance_date ?? "");
      const emp = empMap.get(employeeId);
      const saved = extensions[id];
      const notes = String(row.notes ?? "");
      const dayPunches = punchMap.get(punchKey(employeeId, date)) ?? [];
      const ext =
        saved ??
        defaultExtension({
          displayStatus: inferDisplayStatus(
            String(row.attendance_status ?? ""),
            String(row.check_in_at ?? ""),
            notes,
          ),
          location:
            dayPunches.find((p) => p.deviceLocation)?.deviceLocation ||
            parseLocationFromNotes(notes),
          device:
            dayPunches[0]?.deviceName ||
            dayPunches[0]?.deviceCode ||
            String(row.source ?? ""),
          employeeName: emp?.name || String(row.employee_name ?? "").trim() || undefined,
          employeeCode: emp?.code || String(row.employee_code ?? "").trim() || undefined,
          departmentName:
            cleanDeptName(emp?.dept) || cleanDeptName(String(row.department_name ?? "")),
          departmentId: emp?.deptId || String(row.department_id ?? "").trim() || undefined,
          designationName: emp?.desig,
          managerName: emp?.manager,
          sourceDetail: String(row.source ?? "manual") as AttendanceSource,
          breakMinutes: 0,
          approvalStatus: "approved",
        });
      return mergeRow(row, empMap, shiftMap, ext, Boolean(saved), dayPunches);
    })
    .sort((a, b) => {
      const byDate = b.attendanceDate.localeCompare(a.attendanceDate);
      if (byDate !== 0) return byDate;
      return a.extension.employeeName.localeCompare(b.extension.employeeName);
    });
}

export type AttendanceDirectory = {
  records: AttendanceRecord[];
  /** Inclusive ISO dates currently loaded into `records`. */
  loadedFrom?: string;
  loadedTo?: string;
  options: {
    branches: { id: string; label: string; companyId?: string }[];
    departments: { id: string; label: string }[];
    shifts: { id: string; label: string }[];
    managers: { id: string; label: string }[];
    employees: {
      id: string;
      label: string;
      code: string;
      departmentId: string;
      departmentName?: string;
      designation: string;
      managerId: string;
      branchId?: string;
      companyId?: string;
    }[];
  };
};

export type AttendanceLoadRange = {
  dateFrom: string;
  dateTo: string;
};

function cleanDeptName(value: string | undefined | null): string {
  const v = String(value ?? "").trim();
  return !v || v === "-" ? "" : v;
}

function buildEmpMap(
  empDir: Awaited<ReturnType<typeof loadEmployeeDirectory>>,
): EmpLookup {
  const empMap: EmpLookup = new Map();
  for (const e of empDir.records) {
    empMap.set(e.id, {
      name: e.displayName,
      code: e.employeeCode,
      dept: cleanDeptName(e.departmentName),
      deptId: e.departmentId,
      desig: e.designationName,
      manager: e.reportingManagerName,
    });
  }
  return empMap;
}

function empMapFromOptions(
  employees: AttendanceDirectory["options"]["employees"],
  departments: AttendanceDirectory["options"]["departments"] = [],
): EmpLookup {
  const deptById = new Map(departments.map((d) => [d.id, d.label]));
  const empMap: EmpLookup = new Map();
  for (const e of employees) {
    empMap.set(e.id, {
      name: e.label,
      code: e.code,
      dept:
        cleanDeptName(e.departmentName) ||
        cleanDeptName(deptById.get(e.departmentId)) ||
        "",
      deptId: e.departmentId,
      desig: e.designation,
      manager: "",
    });
  }
  return empMap;
}

/** Load attendance for a date window only (default: today). Reuses filter options from `previous`. */
export async function loadAttendanceDirectory(
  range?: Partial<AttendanceLoadRange>,
  previous?: AttendanceDirectory | null,
): Promise<AttendanceDirectory> {
  const today = todayIso();
  const dateFrom = (range?.dateFrom || today).slice(0, 10);
  const dateTo = (range?.dateTo || dateFrom || today).slice(0, 10);
  const needOptions = !previous?.options?.employees?.length;

  const attPromise = listAllRows(
    "/hr/attendance",
    { date_from: dateFrom, date_to: dateTo },
    20,
  );
  const punchPromise = loadPunchesForRange(dateFrom, dateTo);

  if (!needOptions && previous) {
    const [attRows, punchMap] = await Promise.all([attPromise, punchPromise]);
    const empMap = empMapFromOptions(
      previous.options.employees,
      previous.options.departments,
    );
    const shiftMap = new Map(previous.options.shifts.map((s) => [s.id, s.label]));
    return {
      records: recordsFromRows(attRows, empMap, shiftMap, punchMap),
      loadedFrom: dateFrom,
      loadedTo: dateTo,
      options: previous.options,
    };
  }

  const [attRows, empDir, branchRows, departmentRows, shiftRowsRaw, punchMap] =
    await Promise.all([
      attPromise,
      loadEmployeeDirectory().catch(() => ({
        records: [],
        options: {
          branches: [],
          departments: [],
          designations: [],
          managers: [],
          shifts: [],
        },
        errors: [],
      })),
      listAllRows("/branches", {}, 5),
      listAllRows("/departments", {}, 5),
      listAllRows("/hr/shifts", {}, 5),
      punchPromise,
    ]);

  const empMap = buildEmpMap(empDir);
  const asOpts = (arr: HrRow[], labelKeys: string[]) =>
    arr.map((r) => ({
      id: String(r.id),
      label: String(labelKeys.map((k) => r[k]).find(Boolean) ?? r.id),
    }));
  const departments = asOpts(departmentRows, ["department_name", "name", "department_code"]);
  const deptById = new Map(departments.map((d) => [d.id, d.label]));
  // Fill blank department names from /departments when directory hydration missed them.
  for (const [id, emp] of empMap) {
    if (!cleanDeptName(emp.dept) && emp.deptId) {
      empMap.set(id, {
        ...emp,
        dept: cleanDeptName(deptById.get(emp.deptId)),
      });
    }
  }
  const shiftMap = new Map(
    shiftRowsRaw.map((s) => [String(s.id), String(s.shift_name ?? s.shift_code ?? s.id)]),
  );

  return {
    records: recordsFromRows(attRows, empMap, shiftMap, punchMap),
    loadedFrom: dateFrom,
    loadedTo: dateTo,
    options: {
      branches: branchRows.map((r) => ({
        id: String(r.id),
        label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
        companyId: r.company_id ? String(r.company_id) : undefined,
      })),
      departments,
      shifts: asOpts(shiftRowsRaw, ["shift_name", "shift_code"]),
      managers: empDir.options.managers,
      employees: empDir.records.map((e) => {
        const fromMap = empMap.get(e.id);
        return {
          id: e.id,
          label: e.displayName,
          code: e.employeeCode,
          departmentId: e.departmentId,
          departmentName:
            cleanDeptName(fromMap?.dept) || cleanDeptName(e.departmentName),
          designation: e.designationName,
          managerId: e.reportingManagerId,
          branchId: e.branchId,
          companyId: e.companyId,
        };
      }),
    },
  };
}

export async function loadAttendanceForEmployee(
  employeeId: string,
  directory?: AttendanceDirectory | null,
  range?: { dateFrom?: string; dateTo?: string },
): Promise<AttendanceRecord[]> {
  const attRows: HrRow[] = [];
  const seenFirstIds = new Set<string>();
  const query: Record<string, string | number> = {
    page_size: 200,
    employee_id: employeeId,
  };
  if (range?.dateFrom) query.date_from = range.dateFrom.slice(0, 10);
  if (range?.dateTo) query.date_to = range.dateTo.slice(0, 10);

  for (let page = 1; page <= 30; page += 1) {
    const res = await resourceService
      .list("/hr/attendance", { ...query, page })
      .catch(() => ({ data: [] }));
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    const firstId = rows[0] ? String(rows[0].id ?? "") : "";
    if (page > 1 && firstId && seenFirstIds.has(firstId)) break;
    if (firstId) seenFirstIds.add(firstId);
    attRows.push(...rows);
    if (rows.length < 200) break;
  }

  const empMap = empMapFromOptions(
    directory?.options.employees ?? [],
    directory?.options.departments ?? [],
  );

  const shiftMap = new Map((directory?.options.shifts ?? []).map((s) => [s.id, s.label]));
  const dates = attRows
    .map((r) => String(r.attendance_date ?? ""))
    .filter(Boolean)
    .sort();
  const today = todayIso();
  const punchFrom = range?.dateFrom || dates[0] || today;
  const punchTo = range?.dateTo || dates[dates.length - 1] || today;
  const punchMap = await loadPunchesForRange(punchFrom, punchTo);
  return recordsFromRows(attRows, empMap, shiftMap, punchMap);
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

/** Counted as present for today's dashboard (punched / on site). */
const PRESENT_LIKE_STATUSES = new Set([
  "present",
  "late",
  "half_day",
  "work_from_home",
  "early_exit",
  "missed_punch",
]);

/** Excused from work — not present and not absent. */
const EXCUSED_STATUSES = new Set(["leave", "holiday", "weekend"]);

export type AttendanceRosterEmployee = {
  id: string;
  label: string;
  code: string;
  departmentId: string;
  designation: string;
};

export function matchesAttendanceStatBucket(
  record: AttendanceRecord,
  bucket: AttendanceStatBucket,
  date: string,
): boolean {
  if (record.attendanceDate !== date) return false;
  switch (bucket) {
    case "present":
      return PRESENT_LIKE_STATUSES.has(record.status);
    case "absent":
      return record.status === "absent";
    case "late":
      return record.status === "late" || record.extension.isLate;
    case "missing":
      return record.status === "missed_punch" || record.extension.missedPunch;
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

function rosterMatchingFilters(
  employees: AttendanceRosterEmployee[],
  filters: Pick<AttendanceFilters, "departmentId" | "employeeId" | "designation">,
): AttendanceRosterEmployee[] {
  return employees.filter((e) => {
    if (filters.employeeId && e.id !== filters.employeeId) return false;
    if (filters.departmentId && e.departmentId !== filters.departmentId) return false;
    if (filters.designation && e.designation !== filters.designation) return false;
    return true;
  });
}

function employeeIdsPresentOrExcused(records: AttendanceRecord[], date: string): Set<string> {
  const ids = new Set<string>();
  for (const r of records) {
    if (r.attendanceDate !== date) continue;
    if (PRESENT_LIKE_STATUSES.has(r.status) || EXCUSED_STATUSES.has(r.status)) {
      ids.add(r.employeeId);
    }
  }
  return ids;
}

/** Synthetic absent rows for employees with no punch / leave record today. */
export function impliedAbsentRecords(
  records: AttendanceRecord[],
  date: string,
  employees: AttendanceRosterEmployee[],
  filters: Pick<AttendanceFilters, "departmentId" | "employeeId" | "designation" | "branchId" | "shiftId" | "location">,
): AttendanceRecord[] {
  const todayRows = records.filter((r) => {
    if (r.attendanceDate !== date) return false;
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.shiftId && r.shiftId !== filters.shiftId) return false;
    if (filters.location && !r.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
    return true;
  });
  const covered = employeeIdsPresentOrExcused(todayRows, date);
  const markedAbsent = todayRows.filter((r) => r.status === "absent");
  const markedIds = new Set(markedAbsent.map((r) => r.employeeId));
  const roster = rosterMatchingFilters(employees, filters);
  const synthetic: AttendanceRecord[] = roster
    .filter((e) => !covered.has(e.id) && !markedIds.has(e.id))
    .map((e) => ({
      id: `implied-absent:${date}:${e.id}`,
      employeeId: e.id,
      branchId: "",
      shiftId: "",
      attendanceDate: date,
      checkIn: "",
      checkOut: "",
      workingHours: 0,
      breakTime: 0,
      overtimeHours: 0,
      status: "absent",
      apiStatus: "absent",
      location: "",
      device: "",
      source: "system",
      approvalStatus: "none",
      recordStatus: "implied",
      version: 0,
      notes: "No attendance punch for today",
      punches: [],
      extension: {
        displayStatus: "absent",
        breakStart: "",
        breakEnd: "",
        breakMinutes: 0,
        location: "",
        device: "",
        gpsCoordinates: "",
        sourceDetail: "manual",
        approvalStatus: "none",
        overtimeNormal: 0,
        overtimeDouble: 0,
        isLate: false,
        isEarlyExit: false,
        missedPunch: false,
        departmentName: "",
        departmentId: e.departmentId,
        designationName: e.designation,
        employeeCode: e.code,
        employeeName: e.label,
        shiftName: "",
        managerName: "",
      },
    }));
  return [...markedAbsent, ...synthetic];
}

export function computeDashboardStats(
  records: AttendanceRecord[],
  date: string,
  expectedEmployees: AttendanceRosterEmployee[] = [],
  filters: Pick<AttendanceFilters, "departmentId" | "employeeId" | "designation"> = {
    departmentId: "",
    employeeId: "",
    designation: "",
  },
): Record<AttendanceStatBucket, number> {
  const present = records.filter((r) => matchesAttendanceStatBucket(r, "present", date)).length;
  const late = records.filter((r) => matchesAttendanceStatBucket(r, "late", date)).length;
  const missing = records.filter((r) => matchesAttendanceStatBucket(r, "missing", date)).length;
  const roster = rosterMatchingFilters(expectedEmployees, filters);
  const absent =
    roster.length > 0
      ? roster.filter((e) => !employeeIdsPresentOrExcused(records, date).has(e.id)).length
      : records.filter((r) => matchesAttendanceStatBucket(r, "absent", date)).length;
  return { present, absent, late, missing };
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
    company_id: payload.companyId || null,
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
    "First In",
    "Last Out",
    "Working Hours",
    "Overtime",
    "Status",
    "Location",
    "Source",
    "Approval",
  ];
  const lines = records.map((r) => {
    const punches = r.punches ?? [];
    const firstIn = punches[0]?.punchedAt || r.checkIn || "";
    const lastOut =
      punches.length > 1
        ? punches[punches.length - 1]?.punchedAt || r.checkOut || ""
        : r.checkOut || "";
    return [
      r.attendanceDate,
      r.extension.employeeCode,
      r.extension.employeeName,
      r.extension.departmentName,
      r.extension.shiftName,
      firstIn,
      lastOut,
      formatHoursMinutes(r.workingHours),
      formatHoursMinutes(r.overtimeHours),
      r.status,
      r.location,
      r.source,
      r.approvalStatus,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",");
  });
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

type AttendanceImportEmployee = {
  id: string;
  label: string;
  code: string;
  departmentId: string;
  designation: string;
  managerId: string;
  branchId?: string;
  companyId?: string;
};

/** Normalize machine/HR codes for exact compare (CDPL-5356 → CDPL5356). */
function normEmployeeCode(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[\s\-_/]+/g, "")
    .toUpperCase();
}

/** Letter prefix only (CDPL5356 → CDPL, CT5356 → CT). */
function codeLetterPrefix(raw: string): string {
  const n = normEmployeeCode(raw);
  const m = n.match(/^[A-Z]+/);
  return m?.[0] ?? "";
}

/**
 * Numeric id for cross-prefix match (CDPL5356 / CT5356 / CDPL05356 → 5356).
 * Machine files often keep an old entity prefix (CDPL) while HR Emp ID is CT….
 */
function codeDigitKey(raw: string): string {
  const digits = normEmployeeCode(raw).replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "";
}

function resolveEmployeeByMachineCode(
  machineCode: string,
  byCode: Map<string, AttendanceImportEmployee>,
  byDigits: Map<string, AttendanceImportEmployee[]>,
): { emp: AttendanceImportEmployee | null; via: "exact" | "digits" | null; note?: string } {
  const code = normEmployeeCode(machineCode);
  if (!code) return { emp: null, via: null };
  const exact = byCode.get(code);
  if (exact) return { emp: exact, via: "exact" };

  const dig = codeDigitKey(code);
  if (!dig) return { emp: null, via: null };
  const candidates = byDigits.get(dig) ?? [];
  if (candidates.length === 1) {
    return {
      emp: candidates[0],
      via: "digits",
      note: `${machineCode} → ${candidates[0].code}`,
    };
  }
  if (candidates.length > 1) {
    const machinePrefix = codeLetterPrefix(code);
    // Prefer a different prefix (CDPL5356 → CT5356) over another CDPL* with same digits.
    const remapped = candidates.filter((c) => codeLetterPrefix(c.code) !== machinePrefix);
    if (remapped.length === 1) {
      return {
        emp: remapped[0],
        via: "digits",
        note: `${machineCode} → ${remapped[0].code}`,
      };
    }
    // Prefer CT when machine still shows CDPL (Digitech → Technologies remap).
    if (machinePrefix === "CDPL") {
      const ct = candidates.filter((c) => codeLetterPrefix(c.code) === "CT");
      if (ct.length === 1) {
        return { emp: ct[0], via: "digits", note: `${machineCode} → ${ct[0].code}` };
      }
    }
    return {
      emp: null,
      via: null,
      note: `ambiguous number ${dig}: ${candidates.map((c) => c.code).join(", ")}`,
    };
  }
  return { emp: null, via: null };
}

export async function importAttendanceRows(
  rows: {
    employee_code: string;
    attendance_date: string;
    check_in?: string;
    check_out?: string;
    status?: AttendanceStatusCode;
    source?: string;
  }[],
  directory: AttendanceDirectory,
): Promise<{
  created: number;
  skipped: number;
  skippedUnmatched: number;
  errors: string[];
  warnings: string[];
}> {
  if (!rows.length) {
    return {
      created: 0,
      skipped: 0,
      skippedUnmatched: 0,
      errors: ["No rows to import"],
      warnings: [],
    };
  }

  // Refresh master employees so import sees current Emp IDs + branch/company.
  let employeeSource: AttendanceImportEmployee[] = directory.options.employees.map((e) => ({
    id: e.id,
    label: e.label,
    code: e.code,
    departmentId: e.departmentId,
    designation: e.designation,
    managerId: e.managerId,
    branchId: e.branchId,
    companyId: e.companyId,
  }));
  try {
    const fresh = await loadEmployeeDirectory();
    if (fresh.records.length) {
      employeeSource = fresh.records.map((e) => ({
        id: e.id,
        label: e.displayName,
        code: e.employeeCode,
        departmentId: e.departmentId,
        designation: e.designationName,
        managerId: e.reportingManagerId,
        branchId: e.branchId,
        companyId: e.companyId,
      }));
    }
  } catch {
    // Keep directory.options.employees
  }

  const byCode = new Map<string, AttendanceImportEmployee>();
  const byDigits = new Map<string, AttendanceImportEmployee[]>();
  const mergeEmp = (
    existing: AttendanceImportEmployee | undefined,
    incoming: AttendanceImportEmployee,
  ): AttendanceImportEmployee => {
    if (!existing) return incoming;
    return {
      ...existing,
      ...incoming,
      // Never wipe org scope already loaded from HR master.
      branchId: incoming.branchId || existing.branchId,
      companyId: incoming.companyId || existing.companyId,
      departmentId: incoming.departmentId || existing.departmentId,
      designation: incoming.designation || existing.designation,
      managerId: incoming.managerId || existing.managerId,
      label: incoming.label || existing.label,
      code: incoming.code || existing.code,
    };
  };
  const indexEmp = (e: AttendanceImportEmployee) => {
    const key = normEmployeeCode(e.code);
    if (!key) return;
    byCode.set(key, mergeEmp(byCode.get(key), e));
    const dig = codeDigitKey(key);
    if (!dig) return;
    const list = byDigits.get(dig) ?? [];
    const idx = list.findIndex((x) => x.id === e.id);
    if (idx >= 0) list[idx] = mergeEmp(list[idx], e);
    else list.push(e);
    byDigits.set(dig, list);
  };
  for (const e of employeeSource) indexEmp(e);
  for (const r of directory.records) {
    if (!r.employeeId) continue;
    indexEmp({
      id: r.employeeId,
      label: r.extension.employeeName || r.extension.employeeCode,
      code: r.extension.employeeCode,
      departmentId: r.extension.departmentId || "",
      designation: r.extension.designationName || "",
      managerId: "",
      branchId: r.branchId || undefined,
      companyId: r.companyId || undefined,
    });
  }

  const existing = new Set(directory.records.map((r) => `${r.employeeId}|${r.attendanceDate}`));
  const branchCompany = new Map(
    directory.options.branches
      .filter((b) => b.id && b.companyId)
      .map((b) => [b.id, b.companyId as string]),
  );
  const fallbackBranchId = directory.options.branches[0]?.id ?? "";
  const fallbackCompanyId =
    directory.options.branches.find((b) => b.companyId)?.companyId ||
    employeeSource.find((e) => e.companyId)?.companyId ||
    "";
  const shiftId = directory.options.shifts[0]?.id ?? "";

  let created = 0;
  let skipped = 0;
  let skippedUnmatched = 0;
  const errors: string[] = [];
  const unknownCodes = new Set<string>();
  const remappedCodes = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const code = normEmployeeCode(row.employee_code);
    const date = String(row.attendance_date || "").trim();
    if (!date) {
      errors.push(`Row ${i + 1}: invalid / missing date`);
      skipped += 1;
      continue;
    }
    const resolved = resolveEmployeeByMachineCode(code, byCode, byDigits);
    const emp = resolved.emp;
    if (!emp) {
      // Auto-skip codes that are not in HR (no hard error per row).
      unknownCodes.add(code || "(blank)");
      skippedUnmatched += 1;
      skipped += 1;
      continue;
    }
    if (resolved.via === "digits" && resolved.note) {
      remappedCodes.add(resolved.note);
    }
    if (existing.has(`${emp.id}|${date}`)) {
      skipped += 1;
      continue;
    }
    const status = (row.status || "present") as AttendanceStatusCode;
    const sourceRaw = String(row.source || "biometric").toLowerCase();
    const source = (
      ["manual", "biometric", "mobile", "web", "qr", "face_recognition", "device"].includes(sourceRaw)
        ? sourceRaw
        : "biometric"
    ) as AttendanceSource;
    const branchId = emp.branchId || fallbackBranchId;
    if (!branchId) {
      errors.push(`Row ${i + 1}: employee ${emp.code} has no branch in HR`);
      skipped += 1;
      continue;
    }
    const companyId =
      emp.companyId || branchCompany.get(branchId) || fallbackCompanyId || undefined;
    if (!companyId) {
      errors.push(
        `Row ${i + 1}: employee ${emp.code} has no company in HR (set Legal Entity / company on the employee).`,
      );
      skipped += 1;
      continue;
    }
    try {
      await markAttendance({
        branchId,
        companyId,
        employeeId: emp.id,
        attendanceDate: date,
        shiftId,
        checkIn: row.check_in || "",
        checkOut: row.check_out || "",
        breakStart: "",
        breakEnd: "",
        status,
        location: "Machine import",
        source,
        gpsCoordinates: "",
        notes: `Imported from machine attendance (code ${code}${
          resolved.via === "digits" ? ` ≈ ${emp.code}` : ""
        })`,
      });
      existing.add(`${emp.id}|${date}`);
      created += 1;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "failed"}`);
      skipped += 1;
    }
  }

  const warnings: string[] = [];
  if (remappedCodes.size && created > 0) {
    warnings.push(
      `Matched ${remappedCodes.size} machine code(s) by Emp number (e.g. CDPL5356 → CT5356): ${[...remappedCodes]
        .slice(0, 8)
        .join("; ")}`,
    );
  }
  if (skippedUnmatched > 0) {
    const codes = [...unknownCodes].slice(0, 12).join(", ");
    warnings.push(
      `Skipped ${skippedUnmatched} row(s) with no matching Emp ID${
        codes ? ` (e.g. ${codes})` : ""
      }.`,
    );
  }
  if (!created && skippedUnmatched > 0 && !byCode.size) {
    errors.push("No employees loaded from HR — cannot match machine codes.");
  }

  return {
    created,
    skipped,
    skippedUnmatched,
    errors: errors.slice(0, 25),
    warnings,
  };
}

/** Legacy CSV helper — prefers headers employee_code / attendance_date. */
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

  const codeIdx = idx("employee_code") >= 0 ? idx("employee_code") : idx("code");
  const dateIdx = idx("attendance_date") >= 0 ? idx("attendance_date") : idx("date");
  const inIdx = idx("check_in") >= 0 ? idx("check_in") : idx("first in") >= 0 ? idx("first in") : idx("first_in");
  const outIdx = idx("check_out") >= 0 ? idx("check_out") : idx("last out") >= 0 ? idx("last out") : idx("last_out");
  const statusIdx = idx("status") >= 0 ? idx("status") : idx("attd");
  const sourceIdx = idx("source");
  if (codeIdx < 0 || dateIdx < 0) {
    return {
      created: 0,
      skipped: 0,
      errors: ["Required columns: Code (or employee_code) and Date (or attendance_date)"],
    };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols =
      lines[i]
        .match(/("([^"]|"")*"|[^,]*)/g)
        ?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const date = normalizeAttendanceDate(cols[dateIdx] ?? "");
    if (!date && !(cols[codeIdx] ?? "").trim()) continue;
    rows.push({
      employee_code: cols[codeIdx] ?? "",
      attendance_date: date || (cols[dateIdx] ?? ""),
      check_in: normalizeAttendanceTime(cols[inIdx] ?? ""),
      check_out: normalizeAttendanceTime(cols[outIdx] ?? ""),
      status: mapMachineAttendanceStatus(cols[statusIdx] ?? ""),
      source: cols[sourceIdx] || "biometric",
    });
  }
  return importAttendanceRows(rows, directory);
}

export type RegularizeKind = "full_day" | "half_day" | "absent" | "work_from_home";
export type RegularizePortion = "full_day" | "first_half" | "second_half" | "absent" | "work_from_home";

function resolveRegularizeChoice(
  kind: RegularizeKind,
  halfPortion: "first_half" | "second_half",
): { status: AttendanceStatusCode; portion: RegularizePortion; label: string } {
  if (kind === "full_day") {
    return { status: "present", portion: "full_day", label: "full day" };
  }
  if (kind === "half_day") {
    return {
      status: "half_day",
      portion: halfPortion,
      label: halfPortion === "first_half" ? "half day - 1st half" : "half day - 2nd half",
    };
  }
  if (kind === "absent") {
    return { status: "absent", portion: "absent", label: "absent" };
  }
  return { status: "work_from_home", portion: "work_from_home", label: "work from home" };
}

export async function applyAttendanceCorrection(input: {
  record: AttendanceRecord;
  kind: RegularizeKind;
  halfPortion?: "first_half" | "second_half";
  reason: string;
  attachmentName: string;
  /** Optional HH:mm punch overrides (local time on attendance date). */
  checkInTime?: string;
  checkOutTime?: string;
}): Promise<void> {
  const { record, kind, reason, attachmentName } = input;
  const { status: nextStatus, portion, label: portionLabel } = resolveRegularizeChoice(
    kind,
    input.halfPortion ?? "first_half",
  );
  const noteTag = `regularized:${portion}`;
  const baseNotes = (record.notes || "")
    .replace(/\s*·?\s*regularized:(full_day|first_half|second_half|absent|work_from_home)/g, "")
    .replace(/\s*·?\s*Corrected:[^·]*/g, "")
    .trim();
  const notes = [baseNotes, noteTag, reason].filter(Boolean).join(" · ");

  const nextCheckIn =
    input.checkInTime != null && String(input.checkInTime).trim()
      ? parseTimeOnDate(record.attendanceDate, String(input.checkInTime).trim())
      : null;
  const nextCheckOut =
    input.checkOutTime != null && String(input.checkOutTime).trim()
      ? parseTimeOnDate(record.attendanceDate, String(input.checkOutTime).trim())
      : null;
  const checkInIso = nextCheckIn || record.checkIn || null;
  const checkOutIso = nextCheckOut || record.checkOut || null;
  const punchesChanged =
    (nextCheckIn && nextCheckIn !== record.checkIn) ||
    (nextCheckOut && nextCheckOut !== record.checkOut);
  const workingHours =
    checkInIso && checkOutIso ? diffHours(checkInIso, checkOutIso, record.breakTime || 0) : record.workingHours;

  await resourceService.update("/hr/attendance", record.id, {
    version: record.version,
    attendance_status: mapToApiStatus(nextStatus),
    notes,
    ...(checkInIso ? { check_in_at: checkInIso } : {}),
    ...(checkOutIso ? { check_out_at: checkOutIso } : {}),
    ...(Number.isFinite(workingHours) ? { working_hours: workingHours } : {}),
  });

  await submitCorrection({
    attendanceId: record.id,
    employeeId: record.employeeId,
    date: record.attendanceDate,
    field: punchesChanged ? "check_in" : "attendance_status",
    oldTime: punchesChanged
      ? `in ${formatPunchAudit(record.checkIn)} / out ${formatPunchAudit(record.checkOut)}`
      : record.status,
    newTime: punchesChanged
      ? `in ${formatPunchAudit(checkInIso)} / out ${formatPunchAudit(checkOutIso)} · ${nextStatus}`
      : nextStatus,
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
    detail: punchesChanged
      ? `${record.status} → ${nextStatus} (${portionLabel}); punches updated`
      : `${record.status} → ${nextStatus} (${portionLabel})`,
    actor: actorLabel(),
  });
}

function formatPunchAudit(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}
