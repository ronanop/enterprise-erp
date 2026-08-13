import { resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import { cacheRosterAssignments } from "@/services/hr-master-connector";
import { isWeeklyOffDay } from "@/lib/hr/weekly-off-rules";
import { consumeShiftCode, syncShiftCodesFromList } from "@/config/shift-id";
import type { HrRow } from "@/services/hr-service";
import type {
  AssignShiftPayload,
  CreateShiftPayload,
  RosterCell,
  ShiftAssignmentRecord,
  ShiftAuditEntry,
  ShiftExtension,
  ShiftFilters,
  ShiftRecord,
  ShiftRotation,
  ShiftSwapRequest,
  ShiftTypeCode,
  WeeklyOffRule,
} from "@/types/shift-roster-management";
import { DEFAULT_SHIFT_EXTENSION } from "@/types/shift-roster-management";

const EXT_KEY = "erp_shift_extensions_v1";
const ASSIGN_EXT_KEY = "erp_shift_assignment_ext_v1";
const ROTATIONS_KEY = "erp_shift_rotations_v1";
const SWAPS_KEY = "erp_shift_swaps_v1";
const ROSTER_KEY = "erp_roster_cells_v1";
const AUDIT_KEY = "erp_shift_audit_v1";
const WEEKLY_OFF_KEY = "erp_weekly_off_rules_v1";
const WEEKLY_OFF_ALT_START_KEY = "erp_weekly_off_alt_sat_start_v1";

function actor(): string {
  return "HR User";
}

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

export function appendShiftAudit(entry: Omit<ShiftAuditEntry, "id" | "at">): void {
  const all = readJson<ShiftAuditEntry[]>(AUDIT_KEY, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  writeJson(AUDIT_KEY, all.slice(0, 5000));
}

export function listShiftAudit(): ShiftAuditEntry[] {
  return readJson<ShiftAuditEntry[]>(AUDIT_KEY, []);
}

function mapApiShiftType(t: ShiftTypeCode): string {
  if (t === "flexible" || t === "split") return "general";
  if (t === "rotational") return "rotational";
  return t;
}

function parseTime(t: unknown): string {
  if (typeof t !== "string") return "";
  const m = t.match(/(\d{2}:\d{2})/);
  return m ? m[1] : t;
}

function mergeShift(row: HrRow, ext: ShiftExtension): ShiftRecord {
  return {
    id: String(row.id),
    shiftCode: String(row.shift_code ?? ""),
    shiftName: String(row.shift_name ?? ""),
    shiftType: String(row.shift_type ?? "general") as ShiftTypeCode,
    startTime: parseTime(row.start_time),
    endTime: parseTime(row.end_time),
    graceMinutes: Number(row.grace_minutes ?? 0),
    breakMinutes: Number(row.break_minutes ?? 0),
    isOvernight: Boolean(row.is_overnight),
    status: String(row.status ?? "active"),
    version: Number(row.version ?? 1),
    branchId: String(row.branch_id ?? ""),
    extension: ext,
  };
}

export type ShiftRosterDirectory = {
  shifts: ShiftRecord[];
  assignments: ShiftAssignmentRecord[];
  rotations: ShiftRotation[];
  swaps: ShiftSwapRequest[];
  rosterCells: RosterCell[];
  weeklyOffRules: WeeklyOffRule[];
  weeklyOffAlternateSaturdayStart: string;
  holidays: { date: string; name: string; type: string }[];
  options: {
    branches: { id: string; label: string }[];
    employees: {
      id: string;
      label: string;
      code: string;
      departmentId: string;
      departmentName: string;
      managerId: string;
      managerCode: string;
      managerName: string;
    }[];
    managers: { id: string; label: string; code: string }[];
    shifts: { id: string; label: string; color: string; code: string }[];
  };
};

export async function loadShiftRosterDirectory(): Promise<ShiftRosterDirectory> {
  const [shiftRes, assignRes, holidayRes, empDir, branches, weeklyOffRes] = await Promise.all([
    resourceService.list("/hr/shifts").catch(() => ({ data: [] })),
    resourceService.list("/hr/shift-assignments").catch(() => ({ data: [] })),
    resourceService.list("/hr/holiday-calendars").catch(() => ({ data: [] })),
    loadEmployeeDirectory().catch(() => ({
      records: [],
      options: { branches: [], departments: [], designations: [], managers: [], shifts: [] },
      errors: [],
    })),
    resourceService.list("/branches").catch(() => ({ data: [] })),
    resourceService.list("/hr/weekly-off-policies").catch(() => ({ data: [] })),
  ]);

  const shiftRows = (Array.isArray(shiftRes.data) ? shiftRes.data : []) as HrRow[];
  const assignRows = (Array.isArray(assignRes.data) ? assignRes.data : []) as HrRow[];
  const shiftExts = readJson<Record<string, ShiftExtension>>(EXT_KEY, {});
  const assignExts = readJson<Record<string, { assignmentType: string; notes: string; effectiveTo: string }>>(ASSIGN_EXT_KEY, {});

  syncShiftCodesFromList(shiftRows.map((s) => String(s.shift_code ?? "")));

  const empById = new Map(empDir.records.map((e) => [e.id, e]));

  const shifts = shiftRows.map((row) => {
    const id = String(row.id);
    return mergeShift(row, shiftExts[id] ?? { ...DEFAULT_SHIFT_EXTENSION });
  });

  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const branchRows = (Array.isArray(branches.data) ? branches.data : []) as HrRow[];
  const branchMap = new Map(
    branchRows.map((b) => [String(b.id), String(b.branch_name ?? b.name ?? b.id)]),
  );

  const assignments: ShiftAssignmentRecord[] = assignRows.map((row) => {
    const id = String(row.id);
    const emp = empById.get(String(row.employee_id));
    const sh = shiftById.get(String(row.shift_id));
    const ax = assignExts[id];
    return {
      id,
      documentNumber: String(row.document_number ?? id.slice(0, 8)),
      employeeId: String(row.employee_id),
      employeeName: emp?.displayName ?? String(row.employee_id).slice(0, 8),
      employeeCode: emp?.employeeCode ?? "",
      departmentName: emp?.departmentName ?? "—",
      branchId: String(row.branch_id ?? ""),
      branchName: branchMap.get(String(row.branch_id ?? "")) ?? "—",
      shiftId: String(row.shift_id),
      shiftName: sh?.shiftName ?? "—",
      shiftColor: sh?.extension.color ?? "#64748b",
      effectiveFrom: String(row.effective_from ?? ""),
      effectiveTo: ax?.effectiveTo ?? String(row.effective_to ?? ""),
      assignmentType: (ax?.assignmentType ?? "permanent") as ShiftAssignmentRecord["assignmentType"],
      notes: ax?.notes ?? "",
      status: String(row.status ?? "draft"),
      version: Number(row.version ?? 1),
    };
  });

  // Share assignments with Attendance module for shift prefill
  cacheRosterAssignments(
    assignments.map((a) => ({
      employeeId: a.employeeId,
      shiftId: a.shiftId,
      effectiveFrom: a.effectiveFrom,
      effectiveTo: a.effectiveTo || undefined,
    })),
  );

  const holidays: { date: string; name: string; type: string }[] = [];
  for (const cal of (Array.isArray(holidayRes.data) ? holidayRes.data : []) as HrRow[]) {
    const json = cal.holidays_json;
    if (Array.isArray(json)) {
      for (const h of json) {
        if (h && typeof h === "object" && "date" in h) {
          holidays.push({
            date: String((h as { date: string }).date),
            name: String((h as { name?: string }).name ?? "Holiday"),
            type: "company",
          });
        }
      }
    }
  }

  const weeklyOffRows = (Array.isArray(weeklyOffRes.data) ? weeklyOffRes.data : []) as HrRow[];
  const activePolicy =
    weeklyOffRows.find((p) => p.is_default && p.status === "active") ??
    weeklyOffRows.find((p) => p.status === "active") ??
    weeklyOffRows[0];
  const apiRules = Array.isArray(activePolicy?.rules_json)
    ? (activePolicy.rules_json as WeeklyOffRule[])
    : null;
  const weeklyOffRules = apiRules?.length
    ? apiRules
    : readJson<WeeklyOffRule[]>(WEEKLY_OFF_KEY, ["sunday"]);
  const weeklyOffAlternateSaturdayStart = activePolicy?.alternate_saturday_start
    ? String(activePolicy.alternate_saturday_start).slice(0, 10)
    : readJson<string>(WEEKLY_OFF_ALT_START_KEY, "");

  const [rotApi, swapApi] = await Promise.all([
    resourceService.list("/hr/shift-rotations", { page_size: 200 }).catch(() => ({ data: [] })),
    resourceService.list("/hr/shift-swaps", { page_size: 200 }).catch(() => ({ data: [] })),
  ]);
  const apiRotations = (Array.isArray(rotApi.data) ? rotApi.data : []).map((r) => {
    const row = r as HrRow;
    let sequence: string[] = [];
    let employeeIds: string[] = [];
    try {
      sequence = JSON.parse(String(row.sequence_json ?? "[]"));
    } catch {
      sequence = [];
    }
    try {
      employeeIds = JSON.parse(String(row.employee_ids_json ?? "[]"));
    } catch {
      employeeIds = [];
    }
    return {
      id: String(row.id),
      name: String(row.rotation_name ?? ""),
      code: String(row.rotation_code ?? ""),
      cycle: String(row.cycle ?? "weekly") as ShiftRotation["cycle"],
      sequence,
      employeeIds,
      effectiveFrom: String(row.effective_from ?? ""),
      status: String(row.status ?? "active"),
    } satisfies ShiftRotation;
  });
  const apiSwaps = (Array.isArray(swapApi.data) ? swapApi.data : []).map((r) => {
    const row = r as HrRow;
    const status = String(row.status ?? "draft");
    const workflowStage =
      status === "approved"
        ? "approved"
        : status === "rejected"
          ? "rejected"
          : status === "manager_approved" || status === "submitted"
            ? "manager"
            : "pending";
    return {
      id: String(row.id),
      employeeId: String(row.employee_id ?? ""),
      employeeName: String(row.employee_id ?? ""),
      currentShiftId: String(row.current_shift_id ?? ""),
      requestedShiftId: String(row.requested_shift_id ?? ""),
      swapWithEmployeeId: String(row.swap_with_employee_id ?? ""),
      reason: String(row.reason ?? ""),
      workflowStage: workflowStage as ShiftSwapRequest["workflowStage"],
      createdAt: String(row.created_at ?? new Date().toISOString()),
    } satisfies ShiftSwapRequest;
  });

  const employees = empDir.records.map((e) => {
    const mgr = empById.get(e.reportingManagerId);
    return {
      id: e.id,
      label: e.displayName,
      code: e.employeeCode,
      departmentId: e.departmentId,
      departmentName: e.departmentName,
      managerId: e.reportingManagerId || "",
      managerCode: mgr?.employeeCode ?? "",
      managerName: e.reportingManagerName || mgr?.displayName || "",
    };
  });

  const managerIdsWithReports = new Set(
    employees.map((e) => e.managerId).filter(Boolean),
  );
  const managers = empDir.records
    .filter((e) => managerIdsWithReports.has(e.id))
    .map((e) => ({
      id: e.id,
      label: e.displayName,
      code: e.employeeCode,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    shifts,
    assignments,
    rotations: apiRotations.length ? apiRotations : readJson<ShiftRotation[]>(ROTATIONS_KEY, []),
    swaps: apiSwaps.length ? apiSwaps : readJson<ShiftSwapRequest[]>(SWAPS_KEY, []),
    rosterCells: readJson<RosterCell[]>(ROSTER_KEY, []),
    weeklyOffRules,
    weeklyOffAlternateSaturdayStart,
    holidays,
    options: {
      branches: branchRows.map((b) => ({
        id: String(b.id),
        label: String(b.branch_name ?? b.name ?? b.id),
      })),
      employees,
      managers,
      shifts: shifts.map((s) => ({
        id: s.id,
        label: `${s.shiftName} (${s.shiftCode})`,
        color: s.extension.color,
        code: s.shiftCode,
      })),
    },
  };
}

export function computeShiftDashboardStats(dir: ShiftRosterDirectory) {
  const activeShifts = dir.shifts.filter((s) => s.status === "active").length;
  const assignedEmployees = new Set(dir.assignments.map((a) => a.employeeId)).size;
  const nightShifts = dir.shifts.filter((s) => s.shiftType === "night" || s.isOvernight).length;
  return {
    totalShifts: dir.shifts.length,
    activeShifts,
    employeesAssigned: assignedEmployees,
    rotations: dir.rotations.length,
    nightShifts,
    weeklyOffRules: dir.weeklyOffRules.length,
  };
}

export function filterShifts(shifts: ShiftRecord[], query: string, filters: ShiftFilters): ShiftRecord[] {
  const q = query.trim().toLowerCase();
  return shifts.filter((s) => {
    if (filters.shiftType && s.shiftType !== filters.shiftType) return false;
    if (filters.status && s.status !== filters.status) return false;
    if (filters.branchId && s.branchId !== filters.branchId) return false;
    if (!q) return true;
    return [s.shiftName, s.shiftCode, s.shiftType].join(" ").toLowerCase().includes(q);
  });
}

export function filterAssignments(
  rows: ShiftAssignmentRecord[],
  query: string,
  filters: ShiftFilters,
): ShiftAssignmentRecord[] {
  const q = query.trim().toLowerCase();
  return rows.filter((a) => {
    if (filters.branchId && a.branchId !== filters.branchId) return false;
    if (filters.departmentId) {
      const emp = a.departmentName;
      void emp;
    }
    if (filters.assignmentType && a.assignmentType !== filters.assignmentType) return false;
    if (!q) return true;
    return [a.employeeName, a.employeeCode, a.shiftName].join(" ").toLowerCase().includes(q);
  });
}

export async function createShift(payload: CreateShiftPayload): Promise<void> {
  const code = payload.shiftCode || consumeShiftCode();
  const res = await resourceService.create("/hr/shifts", {
    branch_id: payload.branchId || null,
    shift_code: code,
    shift_name: payload.shiftName,
    shift_type: mapApiShiftType(payload.shiftType),
    start_time: `${payload.startTime}:00`,
    end_time: `${payload.endTime}:00`,
    grace_minutes: payload.graceMinutes,
    break_minutes: payload.breakMinutes || null,
    is_overnight: payload.isOvernight,
    status: "active",
  });
  const id = String((res.data as HrRow).id);
  writeJson(EXT_KEY, { ...readJson(EXT_KEY, {}), [id]: payload.extension });
  appendShiftAudit({ action: "shift_created", detail: `${payload.shiftName} (${code})`, actor: actor() });
}

export async function updateShift(
  record: ShiftRecord,
  payload: Omit<CreateShiftPayload, "shiftCode" | "branchId"> & {
    status?: string;
  },
): Promise<void> {
  await resourceService.update("/hr/shifts", record.id, {
    version: record.version,
    shift_name: payload.shiftName,
    shift_type: mapApiShiftType(payload.shiftType),
    start_time: `${payload.startTime}:00`,
    end_time: `${payload.endTime}:00`,
    grace_minutes: payload.graceMinutes,
    break_minutes: payload.breakMinutes || null,
    is_overnight: payload.isOvernight,
    status: payload.status || record.status || "active",
  });
  writeJson(EXT_KEY, { ...readJson(EXT_KEY, {}), [record.id]: payload.extension });
  appendShiftAudit({
    action: "shift_updated",
    detail: `${payload.shiftName} (${record.shiftCode})`,
    actor: actor(),
  });
}

export async function assignShift(payload: AssignShiftPayload): Promise<void> {
  const res = await resourceService.create("/hr/shift-assignments", {
    branch_id: payload.branchId,
    employee_id: payload.employeeId,
    shift_id: payload.shiftId,
    effective_from: payload.effectiveFrom,
    effective_to: payload.effectiveTo || null,
  });
  const id = String((res.data as HrRow).id);
  const all = readJson<Record<string, { assignmentType: string; notes: string; effectiveTo: string }>>(ASSIGN_EXT_KEY, {});
  all[id] = {
    assignmentType: payload.assignmentType,
    notes: payload.notes,
    effectiveTo: payload.effectiveTo,
  };
  writeJson(ASSIGN_EXT_KEY, all);
  appendShiftAudit({
    action: "shift_assigned",
    detail: `Employee ${payload.employeeId} → shift ${payload.shiftId}`,
    actor: actor(),
  });
}

export async function saveRotation(rotation: Omit<ShiftRotation, "id"> & { id?: string }): Promise<void> {
  const branchId =
    readJson<{ branchId?: string }>("erp_ats_api_context_v1", {}).branchId ||
    readJson<{ defaultBranchId?: string }>("erp_user_profile", {}).defaultBranchId;
  if (branchId) {
    try {
      await resourceService.create("/hr/shift-rotations", {
        branch_id: branchId,
        rotation_code: rotation.code,
        rotation_name: rotation.name,
        cycle: rotation.cycle,
        sequence: rotation.sequence,
        employee_ids: rotation.employeeIds,
        effective_from: rotation.effectiveFrom,
        status: rotation.status || "active",
      });
      appendShiftAudit({ action: "rotation_saved", detail: rotation.name, actor: actor() });
      return;
    } catch (err) {
      console.warn("Rotation API save failed; local cache kept", err);
    }
  }
  const all = readJson<ShiftRotation[]>(ROTATIONS_KEY, []);
  const item: ShiftRotation = {
    ...rotation,
    id: rotation.id ?? crypto.randomUUID(),
  };
  const idx = all.findIndex((r) => r.id === item.id);
  if (idx >= 0) all[idx] = item;
  else all.unshift(item);
  writeJson(ROTATIONS_KEY, all);
  appendShiftAudit({ action: "rotation_saved", detail: item.name, actor: actor() });
}

export async function submitShiftSwap(
  req: Omit<ShiftSwapRequest, "id" | "createdAt" | "workflowStage">,
): Promise<void> {
  const branchId =
    readJson<{ branchId?: string }>("erp_ats_api_context_v1", {}).branchId ||
    readJson<{ defaultBranchId?: string }>("erp_user_profile", {}).defaultBranchId;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (branchId && uuidRe.test(req.employeeId)) {
    try {
      const created = await resourceService.create<{ id?: string }>("/hr/shift-swaps", {
        branch_id: branchId,
        employee_id: req.employeeId,
        swap_with_employee_id: uuidRe.test(req.swapWithEmployeeId) ? req.swapWithEmployeeId : null,
        current_shift_id: uuidRe.test(req.currentShiftId) ? req.currentShiftId : null,
        requested_shift_id: uuidRe.test(req.requestedShiftId) ? req.requestedShiftId : null,
        swap_date: new Date().toISOString().slice(0, 10),
        reason: req.reason,
        status: "draft",
      });
      const id = created.data?.id;
      if (id) await resourceService.action("/hr/shift-swaps", id, "submit");
      appendShiftAudit({ action: "swap_requested", detail: req.reason, actor: actor() });
      return;
    } catch (err) {
      console.warn("Shift swap API failed; local cache kept", err);
    }
  }
  const all = readJson<ShiftSwapRequest[]>(SWAPS_KEY, []);
  all.unshift({
    ...req,
    id: crypto.randomUUID(),
    workflowStage: "manager",
    createdAt: new Date().toISOString(),
  });
  writeJson(SWAPS_KEY, all);
  appendShiftAudit({ action: "swap_requested", detail: req.reason, actor: actor() });
}

export async function approveSwap(id: string): Promise<void> {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(id)) {
    try {
      await resourceService.action("/hr/shift-swaps", id, "approve");
      appendShiftAudit({ action: "swap_approved", detail: id, actor: actor() });
      return;
    } catch (err) {
      console.warn("Swap approve API failed; local cache kept", err);
    }
  }
  const all = readJson<ShiftSwapRequest[]>(SWAPS_KEY, []);
  const item = all.find((s) => s.id === id);
  if (item) item.workflowStage = "approved";
  writeJson(SWAPS_KEY, all);
  appendShiftAudit({ action: "swap_approved", detail: id, actor: actor() });
}

export async function setRosterCell(cell: RosterCell): Promise<void> {
  const all = readJson<RosterCell[]>(ROSTER_KEY, []);
  const idx = all.findIndex((c) => c.date === cell.date && c.employeeId === cell.employeeId);
  if (idx >= 0) all[idx] = cell;
  else all.push(cell);
  writeJson(ROSTER_KEY, all);

  // Persist to API when employee/shift are UUIDs
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(cell.employeeId) && cell.shiftId && uuidRe.test(cell.shiftId)) {
    try {
      const { resourceService } = await import("@/services/api-client");
      const branchId =
        readJson<{ branchId?: string }>("erp_ats_api_context_v1", {}).branchId ||
        readJson<{ defaultBranchId?: string }>("erp_user_profile", {}).defaultBranchId;
      await resourceService.create("/hr/roster-entries", {
        branch_id: branchId,
        employee_id: cell.employeeId,
        shift_id: cell.shiftId,
        roster_date: cell.date,
        status: "published",
        notes: cell.shiftName || null,
      });
    } catch (err) {
      console.warn("Roster API save failed; local cell kept", err);
    }
  }

  appendShiftAudit({
    action: "roster_updated",
    detail: `${cell.employeeId} ${cell.date} → ${cell.shiftName}`,
    actor: actor(),
  });
}

export async function clearRosterCell(date: string, employeeId: string): Promise<void> {
  const all = readJson<RosterCell[]>(ROSTER_KEY, []);
  writeJson(
    ROSTER_KEY,
    all.filter((c) => !(c.date === date && c.employeeId === employeeId)),
  );
}

export type ManagerRosterImportRow = {
  employeeCode: string;
  employeeName: string;
  date: string;
  value: string;
};

export type ManagerRosterValidation = {
  managerCode: string;
  managerName: string;
  month: string;
  ok: number;
  cleared: number;
  errors: string[];
  cells: RosterCell[];
  clearKeys: { date: string; employeeId: string }[];
};

function daysInMonth(month: string): string[] {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const count = new Date(y, mo, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(`${m[1]}-${m[2]}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

/** Excel-safe day header (avoids #### / auto date conversion). */
function dayHeader(day: number): string {
  return `d${String(day).padStart(2, "0")}`;
}

function csvEscape(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function findShiftByToken(dir: ShiftRosterDirectory, token: string) {
  const t = token.trim().toLowerCase();
  if (!t) return undefined;
  return dir.shifts.find(
    (s) =>
      s.shiftCode.toLowerCase() === t ||
      s.shiftName.toLowerCase() === t ||
      s.shiftType.toLowerCase() === t ||
      `${s.shiftName} (${s.shiftCode})`.toLowerCase() === t,
  );
}

function shiftCodeForId(dir: ShiftRosterDirectory, shiftId: string, fallbackName = ""): string {
  const sh = dir.shifts.find((s) => s.id === shiftId);
  if (sh?.shiftCode) return sh.shiftCode;
  if (fallbackName) {
    const byName = findShiftByToken(dir, fallbackName);
    if (byName?.shiftCode) return byName.shiftCode;
    // Keep readable name so managers still see something useful in the sheet
    return fallbackName.trim();
  }
  return "";
}

function resolveRotationCode(
  dir: ShiftRosterDirectory,
  date: string,
  employeeId: string,
): string | null {
  const rot = dir.rotations.find(
    (r) =>
      r.status === "active" &&
      r.employeeIds.includes(employeeId) &&
      r.effectiveFrom &&
      r.effectiveFrom <= date &&
      r.sequence.length > 0,
  );
  if (!rot) return null;
  const start = new Date(`${rot.effectiveFrom}T12:00:00`);
  const cur = new Date(`${date}T12:00:00`);
  const dayDiff = Math.floor((cur.getTime() - start.getTime()) / 86_400_000);
  if (dayDiff < 0) return null;
  const token = String(rot.sequence[dayDiff % rot.sequence.length] ?? "").trim();
  if (!token) return null;
  if (/^(off|wo|weekly.?off)$/i.test(token)) return "WO";
  if (/^(ho|holiday)$/i.test(token)) return "HO";
  const sh = findShiftByToken(dir, token);
  return sh?.shiftCode ?? token;
}

function resolveCellValue(
  dir: ShiftRosterDirectory,
  date: string,
  employeeId: string,
): string {
  const holiday = dir.holidays.some((h) => h.date === date);
  const override = dir.rosterCells.find((c) => c.date === date && c.employeeId === employeeId);
  if (override) {
    if (override.isWeeklyOff) return "WO";
    if (override.isHoliday) return "HO";
    return shiftCodeForId(dir, override.shiftId, override.shiftName);
  }
  if (holiday) return "HO";

  const weeklyOff = isWeeklyOffDay(date, dir.weeklyOffRules, {
    alternateSaturdayStart: dir.weeklyOffAlternateSaturdayStart || null,
  });

  const assign = dir.assignments.find(
    (a) =>
      a.employeeId === employeeId &&
      a.effectiveFrom <= date &&
      (!a.effectiveTo || a.effectiveTo >= date) &&
      a.status !== "inactive",
  );
  if (assign) {
    if (weeklyOff) return "WO";
    return shiftCodeForId(dir, assign.shiftId, assign.shiftName);
  }

  const rotated = resolveRotationCode(dir, date, employeeId);
  if (rotated) {
    if (weeklyOff && rotated !== "HO") return "WO";
    return rotated;
  }

  if (weeklyOff) return "WO";
  return "";
}

/**
 * Map a CSV day column header back to YYYY-MM-DD.
 * Accepts: d01 / day_01 / 2025-07-01 / Excel 7/1/2025 / 01-07-2025.
 */
function headerToDate(header: string, month: string): string | null {
  const h = header.trim().replace(/^="+|"+$/g, "").trim();
  if (!h) return null;

  const dayKey = h.match(/^(?:d|day[_\s-]?)(\d{1,2})$/i);
  if (dayKey && /^\d{4}-\d{2}$/.test(month)) {
    const day = Number(dayKey[1]);
    if (day >= 1 && day <= 31) {
      return `${month}-${String(day).padStart(2, "0")}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(h)) return h;

  // Excel US: M/D/YYYY
  const us = h.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  // Excel EU / dash: D-M-YYYY or D/M/YYYY when month column is known
  const eu = h.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (eu && /^\d{4}-\d{2}$/.test(month)) {
    const a = Number(eu[1]);
    const b = Number(eu[2]);
    const y = eu[3];
    const monthNum = Number(month.slice(5, 7));
    // Prefer D-M when second part matches roster month
    if (b === monthNum && a >= 1 && a <= 31) {
      return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    if (a === monthNum && b >= 1 && b <= 31) {
      return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }
  }

  return null;
}

/** Build manager-wise month roster CSV (matrix). */
export function exportManagerRosterCsv(
  dir: ShiftRosterDirectory,
  managerId: string,
  month: string,
): { filename: string; csv: string; teamCount: number } {
  const manager = dir.options.managers.find((m) => m.id === managerId)
    ?? dir.options.employees.find((e) => e.id === managerId);
  if (!manager) throw new Error("Manager not found");

  const team = dir.options.employees
    .filter((e) => e.managerId === managerId)
    .sort((a, b) => a.code.localeCompare(b.code));
  if (!team.length) throw new Error("No employees report to this manager");

  const days = daysInMonth(month);
  if (!days.length) throw new Error("Invalid month (use YYYY-MM)");

  const dayHeaders = days.map((_, i) => dayHeader(i + 1));
  const header = [
    "manager_code",
    "manager_name",
    "month",
    "employee_code",
    "employee_name",
    "department",
    ...dayHeaders,
  ].map((c) => csvEscape(c));

  const activeShifts = dir.shifts.filter((s) => s.status !== "inactive");
  const legend = [
    `# Roster month ${month} · ${days.length} days · fill cells with shift CODE (not name)`,
    `# Special: WO = weekly off · HO = holiday · blank = clear day override`,
    `# Allowed shifts: ${
      activeShifts.length
        ? activeShifts
            .map((s) => `${s.shiftCode}=${s.shiftName}`)
            .join(" | ")
        : "(none configured — add shifts in Shift master)"
    }`,
  ];

  const lines = team.map((emp) => {
    const cells = days.map((d) => resolveCellValue(dir, d, emp.id));
    return [
      manager.code,
      manager.label,
      month,
      emp.code,
      emp.label,
      emp.departmentName,
      ...cells,
    ]
      .map((c) => csvEscape(String(c)))
      .join(",");
  });

  // BOM helps Excel open UTF-8; d01 headers avoid #### date columns
  const csv = `\uFEFF${[...legend, header.join(","), ...lines].join("\n")}`;
  const filename = `roster_${manager.code || "MGR"}_${month}.csv`;
  return { filename, csv, teamCount: team.length };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Validate manager roster CSV and build cells to apply. */
export function validateManagerRosterCsv(
  dir: ShiftRosterDirectory,
  raw: string,
): ManagerRosterValidation {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) {
    return {
      managerCode: "",
      managerName: "",
      month: "",
      ok: 0,
      cleared: 0,
      errors: ["File is empty or missing data rows"],
      cells: [],
      clearKeys: [],
    };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());
  const required = ["manager_code", "manager_name", "month", "employee_code", "employee_name", "department"];
  for (const col of required) {
    if (!headerLower.includes(col)) {
      return {
        managerCode: "",
        managerName: "",
        month: "",
        ok: 0,
        cleared: 0,
        errors: [`Missing column: ${col}`],
        cells: [],
        clearKeys: [],
      };
    }
  }

  const idx = Object.fromEntries(headerLower.map((h, i) => [h, i]));
  const firstData = parseCsvLine(lines[1]);
  const managerCode = firstData[idx.manager_code] ?? "";
  const managerName = firstData[idx.manager_name] ?? "";
  const month = firstData[idx.month] ?? "";

  const dateCols = header
    .map((h, i) => ({ date: headerToDate(h, month), i, raw: h }))
    .filter((c): c is { date: string; i: number; raw: string } => Boolean(c.date));

  if (!dateCols.length) {
    return {
      managerCode,
      managerName,
      month,
      ok: 0,
      cleared: 0,
      errors: [
        "No day columns found. Use d01…d31 (preferred), or YYYY-MM-DD dates.",
      ],
      cells: [],
      clearKeys: [],
    };
  }

  const manager =
    dir.options.managers.find((m) => m.code === managerCode) ||
    dir.options.employees.find((e) => e.code === managerCode);
  if (!manager) {
    return {
      managerCode,
      managerName,
      month,
      ok: 0,
      cleared: 0,
      errors: [`Unknown manager_code: ${managerCode}`],
      cells: [],
      clearKeys: [],
    };
  }

  const teamByCode = new Map(
    dir.options.employees
      .filter((e) => e.managerId === manager.id)
      .map((e) => [e.code.toUpperCase(), e]),
  );

  const expectedDays = new Set(daysInMonth(month));
  const errors: string[] = [];
  const cells: RosterCell[] = [];
  const clearKeys: { date: string; employeeId: string }[] = [];
  let ok = 0;
  let cleared = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const rowMgr = cols[idx.manager_code] ?? "";
    const rowMonth = cols[idx.month] ?? "";
    const empCode = (cols[idx.employee_code] ?? "").toUpperCase();
    if (rowMgr && rowMgr !== managerCode) {
      errors.push(`Row ${r + 1}: manager_code mismatch (${rowMgr})`);
      continue;
    }
    if (rowMonth && rowMonth !== month) {
      errors.push(`Row ${r + 1}: month mismatch (${rowMonth})`);
      continue;
    }
    const emp = teamByCode.get(empCode);
    if (!emp) {
      errors.push(`Row ${r + 1}: ${empCode || "(blank)"} is not under manager ${managerCode}`);
      continue;
    }

    for (const { date, i } of dateCols) {
      if (month && expectedDays.size && !expectedDays.has(date)) {
        errors.push(`Row ${r + 1}: date ${date} outside month ${month}`);
        continue;
      }
      const rawVal = (cols[i] ?? "").trim();
      const value = rawVal.toUpperCase();
      if (!value) {
        clearKeys.push({ date, employeeId: emp.id });
        cleared += 1;
        continue;
      }
      if (value === "WO") {
        cells.push({
          date,
          employeeId: emp.id,
          shiftId: "",
          shiftName: "Weekly Off",
          color: "#94a3b8",
          isWeeklyOff: true,
          isHoliday: false,
        });
        ok += 1;
        continue;
      }
      if (value === "HO") {
        cells.push({
          date,
          employeeId: emp.id,
          shiftId: "",
          shiftName: "Holiday",
          color: "#f59e0b",
          isWeeklyOff: false,
          isHoliday: true,
        });
        ok += 1;
        continue;
      }
      const sh = findShiftByToken(dir, rawVal);
      if (!sh) {
        errors.push(
          `Row ${r + 1} ${date}: unknown shift "${rawVal}" (use a Shift master code or name)`,
        );
        continue;
      }
      cells.push({
        date,
        employeeId: emp.id,
        shiftId: sh.id,
        shiftName: sh.shiftName,
        color: sh.extension.color,
        isWeeklyOff: false,
        isHoliday: false,
      });
      ok += 1;
    }
  }

  return {
    managerCode,
    managerName: manager.label || managerName,
    month,
    ok,
    cleared,
    errors,
    cells,
    clearKeys,
  };
}

export async function applyManagerRosterImport(
  validation: ManagerRosterValidation,
): Promise<void> {
  const all = readJson<RosterCell[]>(ROSTER_KEY, []);
  const clearSet = new Set(validation.clearKeys.map((k) => `${k.employeeId}|${k.date}`));
  let next = all.filter((c) => !clearSet.has(`${c.employeeId}|${c.date}`));

  for (const cell of validation.cells) {
    const idx = next.findIndex((c) => c.date === cell.date && c.employeeId === cell.employeeId);
    if (idx >= 0) next[idx] = cell;
    else next.push(cell);
  }
  writeJson(ROSTER_KEY, next);

  // Best-effort API sync for real shift assignments (skip WO/HO)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const branchId =
    readJson<{ branchId?: string }>("erp_ats_api_context_v1", {}).branchId ||
    readJson<{ defaultBranchId?: string }>("erp_user_profile", {}).defaultBranchId;
  for (const cell of validation.cells) {
    if (!uuidRe.test(cell.employeeId) || !cell.shiftId || !uuidRe.test(cell.shiftId)) continue;
    try {
      await resourceService.create("/hr/roster-entries", {
        branch_id: branchId,
        employee_id: cell.employeeId,
        shift_id: cell.shiftId,
        roster_date: cell.date,
        status: "published",
        notes: cell.shiftName || null,
      });
    } catch {
      // local roster remains source of truth for calendar UI
    }
  }

  appendShiftAudit({
    action: "manager_roster_imported",
    detail: `${validation.managerCode} ${validation.month}: ${validation.ok} cells, ${validation.cleared} cleared, ${validation.errors.length} errors`,
    actor: actor(),
  });
}

export async function saveWeeklyOffRules(
  rules: WeeklyOffRule[],
  alternateSaturdayStart?: string | null,
): Promise<void> {
  writeJson(WEEKLY_OFF_KEY, rules);
  if (alternateSaturdayStart !== undefined) {
    writeJson(WEEKLY_OFF_ALT_START_KEY, alternateSaturdayStart || "");
  }
  try {
    const { apiClient } = await import("@/services/api-client");
    await apiClient("/hr/weekly-off-policies/rules", {
      method: "PUT",
      body: {
        rules_json: rules,
        alternate_saturday_start: alternateSaturdayStart || null,
      },
    });
  } catch {
    try {
      await resourceService.create("/hr/weekly-off-policies", {
        policy_code: "WOFF-001",
        policy_name: "Default Weekly Off",
        rules_json: rules,
        alternate_saturday_start: alternateSaturdayStart || null,
        is_default: true,
        status: "active",
      });
    } catch (err) {
      console.warn("Weekly-off API save failed; kept local cache", err);
    }
  }
  appendShiftAudit({ action: "weekly_off_updated", detail: rules.join(", "), actor: actor() });
}

export async function runAttendanceAutoAbsentJob(): Promise<Record<string, unknown>> {
  const { apiClient } = await import("@/services/api-client");
  const res = await apiClient<Record<string, unknown>>("/hr/attendance/jobs/auto-absent", {
    method: "POST",
  });
  return res.data ?? {};
}

export function exportAssignmentsCsv(rows: ShiftAssignmentRecord[]): string {
  const h = ["Document", "Employee", "Code", "Department", "Shift", "From", "To", "Type", "Status"];
  const lines = rows.map((r) =>
    [r.documentNumber, r.employeeName, r.employeeCode, r.departmentName, r.shiftName, r.effectiveFrom, r.effectiveTo, r.assignmentType, r.status]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [h.join(","), ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shiftUtilizationReport(dir: ShiftRosterDirectory) {
  return dir.shifts.map((s) => ({
    shift: s.shiftName,
    code: s.shiftCode,
    assigned: dir.assignments.filter((a) => a.shiftId === s.id).length,
    type: s.shiftType,
  }));
}

export { peekNextShiftCode } from "@/config/shift-id";
