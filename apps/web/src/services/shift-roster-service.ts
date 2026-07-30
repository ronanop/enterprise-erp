import { resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import { cacheRosterAssignments } from "@/services/hr-master-connector";
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
  holidays: { date: string; name: string; type: string }[];
  options: {
    branches: { id: string; label: string }[];
    employees: { id: string; label: string; code: string; departmentId: string; departmentName: string }[];
    shifts: { id: string; label: string; color: string }[];
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

  return {
    shifts,
    assignments,
    rotations: apiRotations.length ? apiRotations : readJson<ShiftRotation[]>(ROTATIONS_KEY, []),
    swaps: apiSwaps.length ? apiSwaps : readJson<ShiftSwapRequest[]>(SWAPS_KEY, []),
    rosterCells: readJson<RosterCell[]>(ROSTER_KEY, []),
    weeklyOffRules,
    holidays,
    options: {
      branches: branchRows.map((b) => ({
        id: String(b.id),
        label: String(b.branch_name ?? b.name ?? b.id),
      })),
      employees: empDir.records.map((e) => ({
        id: e.id,
        label: e.displayName,
        code: e.employeeCode,
        departmentId: e.departmentId,
        departmentName: e.departmentName,
      })),
      shifts: shifts.map((s) => ({
        id: s.id,
        label: `${s.shiftName} (${s.shiftCode})`,
        color: s.extension.color,
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

export async function saveWeeklyOffRules(rules: WeeklyOffRule[]): Promise<void> {
  writeJson(WEEKLY_OFF_KEY, rules);
  try {
    const { apiClient } = await import("@/services/api-client");
    await apiClient("/hr/weekly-off-policies/rules", {
      method: "PUT",
      body: { rules_json: rules },
    });
  } catch {
    try {
      await resourceService.create("/hr/weekly-off-policies", {
        policy_code: "WOFF-001",
        policy_name: "Default Weekly Off",
        rules_json: rules,
        is_default: true,
        status: "active",
      });
    } catch (err) {
      console.warn("Weekly-off API save failed; kept local cache", err);
    }
  }
  appendShiftAudit({ action: "weekly_off_updated", detail: rules.join(", "), actor: actor() });
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
