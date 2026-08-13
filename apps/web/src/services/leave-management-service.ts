import { apiClient, resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { HrRow } from "@/services/hr-service";
import type {
  ApplyLeavePayload,
  CarryForwardRecord,
  CompOffRecord,
  EncashmentRecord,
  LeaveAuditEntry,
  LeaveBalanceRecord,
  LeaveFilters,
  LeaveRequestExtension,
  LeaveRequestRecord,
  LeaveTypeRecord,
  LeaveValidationResult,
} from "@/types/leave-management";
import {
  DEFAULT_LEAVE_COLORS,
  defaultRequestExtension,
  isVisibleLeaveType,
  leaveStatusDisplay,
} from "@/types/leave-management";
import { validateLeaveCycleOnApply } from "@/lib/hr/leave-cycle-rules";

const EXT_KEY = "erp_leave_request_ext_v1";
const AUDIT_KEY = "erp_leave_audit_v1";
const COMP_OFF_KEY = "erp_leave_compoff_v1";
const ENCASH_KEY = "erp_leave_encash_v1";
const CARRY_KEY = "erp_leave_carry_v1";
const TYPE_EXT_KEY = "erp_leave_type_ext_v1";

function actor(): string {
  if (typeof window === "undefined") return "HR User";
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

export function appendLeaveAudit(entry: Omit<LeaveAuditEntry, "id" | "at">): void {
  const all = readJson<LeaveAuditEntry[]>(AUDIT_KEY, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  writeJson(AUDIT_KEY, all.slice(0, 5000));
}

export function listLeaveAudit(requestId?: string): LeaveAuditEntry[] {
  const all = readJson<LeaveAuditEntry[]>(AUDIT_KEY, []);
  return requestId ? all.filter((a) => a.requestId === requestId) : all;
}

/** Merge stored audit with a derived trail from leave requests and policies. */
export function deriveLeaveAudit(dir: LeaveDirectory | null): LeaveAuditEntry[] {
  const stored = listLeaveAudit();
  if (!dir) return stored;

  const fromRequests: LeaveAuditEntry[] = dir.requests.flatMap((r) => {
    const history = r.extension.approvalHistory ?? [];
    if (history.length) {
      return history.map((h) => ({
        id: h.id || `hist-${r.id}-${h.at}`,
        requestId: r.id,
        action: h.action,
        detail: `${r.employeeName} (${r.employeeCode}) · ${r.leaveTypeName} · ${r.fromDate}–${r.toDate}${
          h.comment ? ` · ${h.comment}` : ""
        }`,
        actor: h.actor || "system",
        at: h.at,
      }));
    }
    return [
      {
        id: `req-${r.id}`,
        requestId: r.id,
        action: r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "recorded",
        detail: `${r.employeeName} (${r.employeeCode}) · ${r.leaveTypeName} · ${r.fromDate}–${r.toDate} · ${r.totalDays}d`,
        actor: r.approverName || "system",
        at: r.appliedOn || `${r.fromDate}T12:00:00`,
      },
    ];
  });

  const fromTypes: LeaveAuditEntry[] = dir.leaveTypes.map((t) => ({
    id: `type-${t.id}`,
    requestId: t.id,
    action: "leave_type_policy",
    detail: `${t.name} (${t.code}) · max ${t.maxDays || "—"}/yr · ${t.daysPerMonth || "—"}/mo · ${t.isPaid ? "paid" : "unpaid"} · CF ${
      t.carryForwardAllowed ? "yes" : "no"
    } · approval ${t.approvalRequired ? "required" : "optional"}`,
    actor: "system",
    at: new Date().toISOString().slice(0, 10) + "T00:00:00",
  }));

  const seen = new Set(stored.map((s) => s.id));
  const merged = [...stored];
  for (const entry of [...fromRequests, ...fromTypes]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }

  return merged.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200);
}

async function listAllRows(apiPath: string): Promise<HrRow[]> {
  const all: HrRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await resourceService.list(apiPath, { page, page_size: 200 }).catch(() => ({ data: [] }));
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all;
}

function dayCount(start: string, end: string, session: string): number {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  let days = Math.floor(ms / 86400000) + 1;
  if (session === "first_half" || session === "second_half") {
    days = Math.max(0.5, days - 0.5);
  }
  return days;
}

function isWeekend(iso: string): boolean {
  const d = new Date(iso).getDay();
  return d === 0 || d === 6;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export type LeaveDirectory = {
  requests: LeaveRequestRecord[];
  balances: LeaveBalanceRecord[];
  leaveTypes: LeaveTypeRecord[];
  holidays: { date: string; name: string }[];
  compOffs: CompOffRecord[];
  encashments: EncashmentRecord[];
  carryForwards: CarryForwardRecord[];
  options: {
    branches: { id: string; label: string }[];
    departments: { id: string; label: string }[];
    employees: {
      id: string;
      label: string;
      code: string;
      departmentId: string;
      departmentName: string;
      managerId: string;
      managerName: string;
      gender: string;
      employmentType: string;
      joiningDate: string;
      branchId: string;
    }[];
    leaveTypes: { id: string; label: string; code: string; color: string }[];
    managers: { id: string; label: string }[];
  };
};

export async function loadLeaveDirectory(): Promise<LeaveDirectory> {
  const [reqRows, balRows, typeRows, holidayRows, empDir, branchRows, deptRows] = await Promise.all([
    listAllRows("/hr/leave-requests"),
    listAllRows("/hr/leave-balances"),
    listAllRows("/hr/leave-types"),
    listAllRows("/hr/holiday-calendars"),
    loadEmployeeDirectory().catch(() => ({
      records: [],
      options: { branches: [], departments: [], designations: [], managers: [], shifts: [] },
      errors: [],
    })),
    listAllRows("/branches"),
    listAllRows("/departments"),
  ]);

  const typeExt = readJson<Record<string, Partial<LeaveTypeRecord>>>(TYPE_EXT_KEY, {});
  const leaveTypes: LeaveTypeRecord[] = typeRows.map((row) => {
    const id = String(row.id);
    const code = String(row.leave_type_code ?? "");
    const ext = typeExt[id] ?? {};
    return {
      id,
      code,
      name: String(row.leave_type_name ?? code),
      isPaid: Boolean(row.is_paid ?? true),
      maxDays: Number(row.max_days_per_year ?? 0),
      daysPerMonth: Number(row.monthly_credit_days ?? 0),
      requiresAttachment: Boolean(row.requires_attachment),
      status: String(row.status ?? "active"),
      version: Number(row.version ?? 1),
      color: ext.color ?? DEFAULT_LEAVE_COLORS[code] ?? "#059669",
      carryForwardAllowed:
        Boolean(row.carry_forward_allowed) || ext.carryForwardAllowed === true,
      approvalRequired: ext.approvalRequired ?? true,
      genderRestriction: ext.genderRestriction ?? "",
      eligibility: ext.eligibility ?? "All employees",
      maxCarryForwardDays:
        row.max_carry_forward_days != null
          ? Number(row.max_carry_forward_days)
          : ext.maxCarryForwardDays,
    };
  });

  const typeById = new Map(leaveTypes.map((t) => [t.id, t]));
  const empById = new Map(empDir.records.map((e) => [e.id, e]));
  const reqExt = readJson<Record<string, LeaveRequestExtension>>(EXT_KEY, {});

  const requests: LeaveRequestRecord[] = reqRows.map((row) => {
    const id = String(row.id);
    const emp = empById.get(String(row.employee_id));
    const lt = typeById.get(String(row.leave_type_id));
    const apiStatus = String(row.status ?? "draft");
    const stageFromApi =
      apiStatus === "submitted"
        ? "manager_review"
        : apiStatus === "manager_approved"
          ? "hr_review"
          : (apiStatus as LeaveRequestExtension["approvalStage"]);
    const ext = {
      ...defaultRequestExtension(),
      ...(reqExt[id] ?? {}),
      approvalStage: stageFromApi || "submitted",
      color: lt?.color ?? "#059669",
    };
    return {
      id,
      documentNumber: String(row.document_number ?? id.slice(0, 8)),
      employeeId: String(row.employee_id),
      employeeName: emp?.displayName ?? String(row.employee_id).slice(0, 8),
      employeeCode: emp?.employeeCode ?? "",
      departmentName: emp?.departmentName ?? "—",
      branchId: String(row.branch_id ?? ""),
      leaveTypeId: String(row.leave_type_id),
      leaveTypeName: lt?.name ?? "—",
      leaveTypeCode: lt?.code ?? "",
      fromDate: String(row.start_date ?? ""),
      toDate: String(row.end_date ?? ""),
      totalDays: Number(row.days_count ?? 0),
      appliedOn: String(row.created_at ?? row.start_date ?? ""),
      status: apiStatus,
      approverName: emp?.reportingManagerName ?? "—",
      reason: String(row.reason ?? ""),
      version: Number(row.version ?? 1),
      extension: ext,
    };
  });

  const pendingByKey = new Map<string, number>();
  for (const r of requests) {
    if (
      ["submitted", "draft", "manager_review", "manager_approved", "hr_review"].includes(r.status) ||
      ["submitted", "manager_review", "manager_approved", "hr_review"].includes(r.extension.approvalStage)
    ) {
      const key = `${r.employeeId}:${r.leaveTypeId}`;
      pendingByKey.set(key, (pendingByKey.get(key) ?? 0) + r.totalDays);
    }
  }

  const balances: LeaveBalanceRecord[] = balRows.map((row) => {
    const emp = empById.get(String(row.employee_id));
    const lt = typeById.get(String(row.leave_type_id));
    const opening = Number(row.opening_balance ?? 0);
    const accrued = Number(row.accrued ?? 0);
    const used = Number(row.used ?? 0);
    const closing = Number(row.closing_balance ?? opening + accrued - used);
    const pending = pendingByKey.get(`${row.employee_id}:${row.leave_type_id}`) ?? 0;
    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      employeeName: emp?.displayName ?? "",
      employeeCode: emp?.employeeCode ?? "",
      branchId: String(row.branch_id ?? emp?.branchId ?? ""),
      leaveTypeId: String(row.leave_type_id),
      leaveTypeName: lt?.name ?? "—",
      leaveTypeCode: lt?.code ?? "",
      balanceYear: Number(row.balance_year ?? new Date().getFullYear()),
      allocated: opening + accrued,
      used,
      pending,
      available: Math.max(0, closing - pending),
      carryForward: 0,
      encashed: 0,
      opening,
      accrued,
      closing,
      lastAccrualYyyymm: row.last_accrual_yyyymm
        ? String(row.last_accrual_yyyymm)
        : undefined,
      version: Number(row.version ?? 1),
    };
  });

  const holidays: { date: string; name: string; type?: string; halfDay?: boolean }[] = [];
  for (const cal of holidayRows) {
    if (String(cal.status ?? "").toLowerCase() === "archived") continue;
    const json = cal.holidays_json;
    const items = Array.isArray(json)
      ? json
      : json && typeof json === "object" && Array.isArray((json as { holidays?: unknown }).holidays)
        ? (json as { holidays: unknown[] }).holidays
        : [];
    for (const h of items) {
      if (!h || typeof h !== "object") continue;
      const row = h as {
        date?: string;
        holiday_date?: string;
        name?: string;
        title?: string;
        holiday_type?: string;
        half_day?: boolean;
      };
      const date = String(row.date ?? row.holiday_date ?? "").slice(0, 10);
      if (!date) continue;
      holidays.push({
        date,
        name: String(row.title ?? row.name ?? "Holiday"),
        type: row.holiday_type,
        halfDay: Boolean(row.half_day),
      });
    }
  }
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    requests,
    balances,
    leaveTypes,
    holidays,
    compOffs: readJson<CompOffRecord[]>(COMP_OFF_KEY, []),
    encashments: readJson<EncashmentRecord[]>(ENCASH_KEY, []),
    carryForwards: readJson<CarryForwardRecord[]>(CARRY_KEY, []),
    options: {
      branches: branchRows.map((b) => ({
        id: String(b.id),
        label: String(b.branch_name ?? b.name ?? b.id),
      })),
      departments: deptRows.map((d) => ({
        id: String(d.id),
        label: String(d.department_name ?? d.name ?? d.id),
      })),
      employees: empDir.records.map((e) => ({
        id: e.id,
        label: e.displayName,
        code: e.employeeCode,
        departmentId: e.departmentId,
        departmentName: e.departmentName,
        managerId: e.reportingManagerId,
        managerName: e.reportingManagerName,
        gender: e.gender,
        employmentType: e.employmentType,
        joiningDate: e.joiningDate,
        branchId: e.branchId,
      })),
      leaveTypes: leaveTypes
        .filter((t) => isVisibleLeaveType(t.code, t.name))
        .filter((t) => String(t.status ?? "active").toLowerCase() === "active")
        .map((t) => ({
        id: t.id,
        label: t.name,
        code: t.code,
        color: t.color,
      })),
      managers: empDir.options.managers,
    },
  };
}

export function computeLeaveStats(dir: LeaveDirectory, today = new Date().toISOString().slice(0, 10)) {
  const pending = dir.requests.filter((r) =>
    ["draft", "submitted", "manager_review", "hr_review", "info_requested", "send_back"].includes(
      r.extension.approvalStage || r.status,
    ),
  ).length;
  const approved = dir.requests.filter((r) => r.status === "approved" || r.extension.approvalStage === "approved").length;
  const rejected = dir.requests.filter((r) => r.status === "rejected" || r.extension.approvalStage === "rejected").length;
  const onLeaveToday = dir.requests.filter(
    (r) =>
      (r.status === "approved" || r.extension.approvalStage === "approved") &&
      r.fromDate <= today &&
      r.toDate >= today,
  ).length;
  const balanceRemaining = dir.balances.reduce((s, b) => s + b.available, 0);
  const upcomingHolidays = dir.holidays.filter((h) => h.date >= today).slice(0, 5).length;
  const carryForward = dir.carryForwards.reduce((s, c) => s + c.carriedDays, 0);
  return { pending, approved, rejected, onLeaveToday, balanceRemaining, upcomingHolidays, carryForward };
}

export function filterLeaveRequests(
  rows: LeaveRequestRecord[],
  query: string,
  filters: LeaveFilters,
  employees: LeaveDirectory["options"]["employees"],
  options?: { statusBucket?: string | null; onLeaveToday?: boolean },
): LeaveRequestRecord[] {
  const q = query.trim().toLowerCase();
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((r) => {
    if (options?.statusBucket) {
      const bucket = leaveStatusDisplay(r.extension.approvalStage || r.status);
      if (bucket.toLowerCase() !== options.statusBucket.toLowerCase()) return false;
    }
    if (options?.onLeaveToday) {
      const approved =
        leaveStatusDisplay(r.extension.approvalStage || r.status) === "Approved" ||
        r.status === "approved";
      if (!approved || r.fromDate > today || r.toDate < today) return false;
    }
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.leaveTypeId && r.leaveTypeId !== filters.leaveTypeId) return false;
    if (filters.status) {
      const bucket = leaveStatusDisplay(r.extension.approvalStage || r.status);
      if (bucket.toLowerCase() !== filters.status.toLowerCase()) return false;
    }
    if (filters.dateFrom && r.toDate < filters.dateFrom) return false;
    if (filters.dateTo && r.fromDate > filters.dateTo) return false;
    const emp = empMap.get(r.employeeId);
    if (filters.departmentId && emp && emp.departmentId !== filters.departmentId) return false;
    if (filters.managerId && emp && emp.managerId !== filters.managerId) return false;
    if (filters.employmentType && emp && emp.employmentType !== filters.employmentType) return false;
    if (!q) return true;
    return [r.employeeName, r.employeeCode, r.departmentName, r.leaveTypeName, r.documentNumber]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function validateLeaveApplication(
  payload: ApplyLeavePayload,
  dir: LeaveDirectory,
): LeaveValidationResult {
  const messages: LeaveValidationResult["messages"] = [];
  const emp = dir.options.employees.find((e) => e.id === payload.employeeId);
  const lt = dir.leaveTypes.find((t) => t.id === payload.leaveTypeId);
  const dates = eachDate(payload.fromDate, payload.toDate);
  const holidaySet = new Set(dir.holidays.map((h) => h.date));
  const weekendOrHoliday = dates.filter((d) => isWeekend(d) || holidaySet.has(d));
  const workingDates = dates.filter((d) => !isWeekend(d) && !holidaySet.has(d));
  const netDays =
    payload.session === "full_day"
      ? workingDates.length
      : workingDates.length === 0
        ? 0
        : payload.fromDate === payload.toDate
          ? 0.5
          : workingDates.length;

  if (!payload.employeeId || !payload.leaveTypeId || !payload.fromDate || !payload.toDate) {
    messages.push({ tone: "error", text: "Employee, leave type, and dates are required." });
  }
  if (payload.toDate < payload.fromDate) {
    messages.push({ tone: "error", text: "To date cannot be before from date." });
  }

  const bal = dir.balances.find(
    (b) => b.employeeId === payload.employeeId && b.leaveTypeId === payload.leaveTypeId,
  );

  const cycle = validateLeaveCycleOnApply({
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    netDays,
    available: bal ? bal.available : null,
    lastAccrualYyyymm: bal?.lastAccrualYyyymm,
    monthlyCreditDays: lt?.daysPerMonth ?? 0,
  });
  if (cycle.error) {
    messages.push({ tone: "error", text: cycle.error });
  } else if (bal && netDays > bal.available) {
    messages.push({
      tone: "error",
      text: `Insufficient balance. Available ${bal.available} day(s), requested ${netDays}.`,
    });
  } else if (!bal) {
    messages.push({ tone: "warn", text: "No leave balance record found for this type — policy check skipped." });
  }
  if (cycle.info) {
    messages.push({ tone: "info", text: cycle.info });
  }

  if (weekendOrHoliday.length) {
    messages.push({
      tone: "info",
      text: `${weekendOrHoliday.length} weekend/holiday day(s) excluded from leave count.`,
    });
  }

  const overlap = dir.requests.find(
    (r) =>
      r.employeeId === payload.employeeId &&
      r.status !== "rejected" &&
      r.status !== "cancelled" &&
      r.fromDate <= payload.toDate &&
      r.toDate >= payload.fromDate,
  );
  if (overlap) {
    messages.push({
      tone: "error",
      text: `Overlapping leave exists (${overlap.documentNumber}: ${overlap.fromDate}–${overlap.toDate}).`,
    });
  }

  if (emp?.joiningDate) {
    const join = new Date(emp.joiningDate);
    const probationEnd = new Date(join);
    probationEnd.setDate(probationEnd.getDate() + 90);
    if (new Date(payload.fromDate) < probationEnd && lt && !["SL", "CL"].includes(lt.code)) {
      messages.push({ tone: "warn", text: "Employee may be in probation — some leave types restricted." });
    }
  }

  if (lt?.genderRestriction && emp?.gender && lt.genderRestriction !== emp.gender) {
    messages.push({
      tone: "error",
      text: `Leave type restricted to ${lt.genderRestriction} employees.`,
    });
  }

  if (lt?.requiresAttachment && !payload.attachmentName) {
    messages.push({ tone: "error", text: "Attachment required for this leave type." });
  }

  if (lt && !lt.approvalRequired) {
    messages.push({ tone: "info", text: "This leave type does not require multi-level approval." });
  }

  const ok = !messages.some((m) => m.tone === "error");
  return { ok, messages, netDays };
}

export async function applyLeave(payload: ApplyLeavePayload, dir: LeaveDirectory): Promise<void> {
  const validation = validateLeaveApplication(payload, dir);
  if (!validation.ok) {
    throw new Error(validation.messages.find((m) => m.tone === "error")?.text ?? "Validation failed");
  }
  const emp = dir.options.employees.find((e) => e.id === payload.employeeId);
  const lt = dir.leaveTypes.find((t) => t.id === payload.leaveTypeId);
  const branchId = payload.branchId || emp?.branchId || dir.options.branches[0]?.id;
  if (!branchId) throw new Error("Branch is required");

  const res = await resourceService.create("/hr/leave-requests", {
    branch_id: branchId,
    employee_id: payload.employeeId,
    leave_type_id: payload.leaveTypeId,
    start_date: payload.fromDate,
    end_date: payload.toDate,
    days_count: validation.netDays || dayCount(payload.fromDate, payload.toDate, payload.session),
    reason: payload.reason || null,
  });

  const row = res.data as HrRow;
  const id = String(row.id);

  try {
    await resourceService.action("/hr/leave-requests", id, "submit");
  } catch {
    /* submit optional if already submitted */
  }

  const ext: LeaveRequestExtension = {
    ...defaultRequestExtension(),
    session: payload.session,
    contactDuringLeave: payload.contactDuringLeave,
    emergencyContact: payload.emergencyContact,
    delegateToEmployeeId: payload.delegateToEmployeeId,
    delegateToName:
      dir.options.employees.find((e) => e.id === payload.delegateToEmployeeId)?.label ?? "",
    attachmentName: payload.attachmentName,
    approvalStage: "manager_review",
    color: lt?.color ?? "#059669",
    approvalHistory: [
      {
        id: crypto.randomUUID(),
        stage: "employee",
        action: "applied",
        comment: payload.reason || "Leave applied",
        actor: actor(),
        at: new Date().toISOString(),
      },
    ],
  };
  writeJson(EXT_KEY, { ...readJson(EXT_KEY, {}), [id]: ext });
  appendLeaveAudit({
    requestId: id,
    action: "leave_applied",
    detail: `${emp?.label ?? payload.employeeId} · ${lt?.name ?? ""} · ${payload.fromDate}–${payload.toDate}`,
    actor: actor(),
  });
}

export async function advanceLeaveApproval(
  request: LeaveRequestRecord,
  action: "approve" | "reject" | "send_back" | "request_info" | "cancel",
  comment: string,
): Promise<void> {
  const all = readJson<Record<string, LeaveRequestExtension>>(EXT_KEY, {});
  const ext = all[request.id] ?? { ...request.extension };
  const apiStatus = (request.status || ext.approvalStage || "submitted").toLowerCase();

  if (action === "approve") {
    const isHrStage =
      apiStatus === "manager_approved" ||
      apiStatus === "hr_review" ||
      ext.approvalStage === "hr_review";
    if (isHrStage) {
      await resourceService.action("/hr/leave-requests", request.id, "approve", {});
      ext.approvalStage = "approved";
    } else {
      await resourceService.action("/hr/leave-requests", request.id, "manager-approve", {});
      ext.approvalStage = "manager_approved";
    }
  } else if (action === "reject") {
    await resourceService.action("/hr/leave-requests", request.id, "reject", {});
    ext.approvalStage = "rejected";
  } else if (action === "send_back") {
    ext.approvalStage = "send_back";
  } else if (action === "request_info") {
    ext.approvalStage = "info_requested";
  } else if (action === "cancel") {
    ext.approvalStage = "cancelled";
  }

  ext.approvalHistory = [
    ...(ext.approvalHistory ?? []),
    {
      id: crypto.randomUUID(),
      stage: ext.approvalStage,
      action,
      comment,
      actor: actor(),
      at: new Date().toISOString(),
    },
  ];
  ext.comments = comment;
  all[request.id] = ext;
  writeJson(EXT_KEY, all);

  appendLeaveAudit({
    requestId: request.id,
    action: `leave_${action}`,
    detail: comment || action,
    actor: actor(),
  });
}

export async function saveCompOff(record: Omit<CompOffRecord, "id"> & { id?: string }): Promise<void> {
  const all = readJson<CompOffRecord[]>(COMP_OFF_KEY, []);
  const item: CompOffRecord = { ...record, id: record.id ?? crypto.randomUUID() };
  try {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let branchId: string | undefined;
    for (const key of ["erp_org_context_v1", "erp_ats_api_context_v1", "erp_pay_api_context_v1"]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { branchId?: string };
        if (parsed.branchId && UUID_RE.test(parsed.branchId)) {
          branchId = parsed.branchId;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (branchId && UUID_RE.test(record.employeeId)) {
      const res = await resourceService.create<Record<string, unknown>>("/hr/leave-balances/compoff-credit", {
        branch_id: branchId,
        employee_id: record.employeeId,
        days: record.days,
        reason: record.reason || null,
        earned_date: record.earnedDate || null,
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        item.id = apiId;
        item.status = "approved";
      }
    }
  } catch (err) {
    console.warn("saveCompOff API failed; local cache kept", err);
  }
  const idx = all.findIndex((c) => c.id === item.id);
  if (idx >= 0) all[idx] = item;
  else all.unshift(item);
  writeJson(COMP_OFF_KEY, all);
  appendLeaveAudit({ requestId: item.id, action: "compoff_saved", detail: item.reason, actor: actor() });
}

export async function saveEncashment(
  record: Omit<EncashmentRecord, "id" | "createdAt"> & { id?: string },
): Promise<void> {
  const all = readJson<EncashmentRecord[]>(ENCASH_KEY, []);
  const item: EncashmentRecord = {
    ...record,
    id: record.id ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  try {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let branchId: string | undefined;
    for (const key of ["erp_org_context_v1", "erp_ats_api_context_v1", "erp_pay_api_context_v1"]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { branchId?: string };
        if (parsed.branchId && UUID_RE.test(parsed.branchId)) {
          branchId = parsed.branchId;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (
      branchId &&
      UUID_RE.test(record.employeeId) &&
      UUID_RE.test(record.leaveTypeId) &&
      record.requestedDays > 0
    ) {
      const today = new Date();
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const created = await resourceService.create<Record<string, unknown>>("/hr/leave-adjustments", {
        branch_id: branchId,
        employee_id: record.employeeId,
        leave_type_id: record.leaveTypeId,
        adjustment_month: monthStart,
        days_delta: -Math.abs(record.requestedDays),
        reason: `Leave encashment${record.amount ? ` · amount ${record.amount}` : ""}`,
        status: "draft",
      });
      const adjId = String(created.data?.id ?? "");
      if (adjId) {
        try {
          await resourceService.action("/hr/leave-adjustments", adjId, "submit");
          await resourceService.action("/hr/leave-adjustments", adjId, "approve");
          item.status = "approved";
        } catch {
          item.status = "pending";
        }
        item.id = adjId;
        item.approvedDays = record.requestedDays;
      }
    }
  } catch (err) {
    console.warn("saveEncashment API failed; local cache kept", err);
  }
  all.unshift(item);
  writeJson(ENCASH_KEY, all);
  appendLeaveAudit({
    requestId: item.id,
    action: "leave_encashed",
    detail: `${item.requestedDays} days · ${item.leaveTypeName}`,
    actor: actor(),
  });
}

export async function generateCarryForward(
  dir: LeaveDirectory,
  maxCarry = 5,
): Promise<CarryForwardRecord[]> {
  const year = new Date().getFullYear() - 1;
  try {
    const res = await resourceService.create<{
      from_year: number;
      to_year: number;
      carried: number;
      closed: number;
      items?: {
        employee_id: string;
        leave_type_id: string;
        carried_days: number;
        unused_days: number;
      }[];
    }>("/hr/leave-balances/carry-forward", {
      from_year: year,
      default_max_days: maxCarry,
    });
    const items = res.data?.items ?? [];
    const empById = new Map(dir.options.employees.map((e) => [e.id, e]));
    const typeById = new Map(dir.leaveTypes.map((t) => [t.id, t]));
    const generated: CarryForwardRecord[] = items.map((it) => ({
      id: crypto.randomUUID(),
      employeeId: it.employee_id,
      employeeName: empById.get(it.employee_id)?.label ?? it.employee_id.slice(0, 8),
      leaveTypeName: typeById.get(it.leave_type_id)?.name ?? "—",
      unusedDays: it.unused_days,
      carriedDays: it.carried_days,
      maxAllowed: maxCarry,
      expiryDate: `${(res.data?.to_year ?? year + 1)}-03-31`,
      year: res.data?.from_year ?? year,
    }));
    writeJson(CARRY_KEY, generated);
    appendLeaveAudit({
      requestId: "batch",
      action: "carry_forward_generated",
      detail: `${res.data?.carried ?? generated.length} balance(s) carried via API`,
      actor: actor(),
    });
    return generated;
  } catch (err) {
    console.warn("carry-forward API failed; falling back to local preview", err);
  }

  const generated: CarryForwardRecord[] = dir.balances
    .filter((b) => b.available > 0)
    .map((b) => {
      const unused = b.available;
      const carried = Math.min(unused, maxCarry);
      return {
        id: crypto.randomUUID(),
        employeeId: b.employeeId,
        employeeName: b.employeeName,
        leaveTypeName: b.leaveTypeName,
        unusedDays: unused,
        carriedDays: carried,
        maxAllowed: maxCarry,
        expiryDate: `${year + 1}-03-31`,
        year,
      };
    });
  writeJson(CARRY_KEY, generated);
  appendLeaveAudit({
    requestId: "batch",
    action: "carry_forward_generated",
    detail: `${generated.length} balance(s) (local preview)`,
    actor: actor(),
  });
  return generated;
}

export function exportLeaveCsv(rows: LeaveRequestRecord[]): string {
  const h = [
    "Document",
    "Employee",
    "ID",
    "Department",
    "Leave Type",
    "From",
    "To",
    "Days",
    "Status",
    "Approver",
  ];
  const lines = rows.map((r) =>
    [
      r.documentNumber,
      r.employeeName,
      r.employeeCode,
      r.departmentName,
      r.leaveTypeName,
      r.fromDate,
      r.toDate,
      r.totalDays,
      r.extension.approvalStage || r.status,
      r.approverName,
    ]
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

export function leaveTrendByMonth(requests: LeaveRequestRecord[]) {
  const map = new Map<string, number>();
  for (const r of requests) {
    const key = r.fromDate.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + r.totalDays);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, days]) => ({ month, days }));
}

export type LeaveTypePolicyUpdate = {
  name: string;
  maxDays: number;
  daysPerMonth: number;
  isPaid: boolean;
  requiresAttachment: boolean;
  status: string;
  color: string;
  carryForwardAllowed: boolean;
  approvalRequired: boolean;
  genderRestriction: string;
  eligibility: string;
};

export async function updateLeaveTypePolicy(
  leaveType: LeaveTypeRecord,
  patch: LeaveTypePolicyUpdate,
): Promise<void> {
  await resourceService.update("/hr/leave-types", leaveType.id, {
    version: leaveType.version,
    leave_type_name: patch.name.trim() || leaveType.name,
    is_paid: patch.isPaid,
    max_days_per_year: patch.maxDays > 0 ? patch.maxDays : null,
    monthly_credit_days: patch.daysPerMonth > 0 ? patch.daysPerMonth : null,
    requires_attachment: patch.requiresAttachment,
    status: patch.status || "active",
  });

  const all = readJson<Record<string, Partial<LeaveTypeRecord>>>(TYPE_EXT_KEY, {});
  all[leaveType.id] = {
    ...(all[leaveType.id] ?? {}),
    color: patch.color || leaveType.color,
    carryForwardAllowed: patch.carryForwardAllowed,
    approvalRequired: patch.approvalRequired,
    genderRestriction: patch.genderRestriction,
    eligibility: patch.eligibility.trim() || "All employees",
  };
  writeJson(TYPE_EXT_KEY, all);

  appendLeaveAudit({
    requestId: leaveType.id,
    action: "leave_type_updated",
    detail: `${patch.name || leaveType.name} (${leaveType.code}) · max ${patch.maxDays}/yr · ${
      patch.daysPerMonth
    }/mo · ${patch.isPaid ? "paid" : "unpaid"} · CF ${patch.carryForwardAllowed ? "yes" : "no"    }`,
    actor: actor(),
  });
}

export async function deleteLeaveType(leaveType: LeaveTypeRecord): Promise<void> {
  await resourceService.delete("/hr/leave-types", leaveType.id);

  const all = readJson<Record<string, Partial<LeaveTypeRecord>>>(TYPE_EXT_KEY, {});
  if (leaveType.id in all) {
    delete all[leaveType.id];
    writeJson(TYPE_EXT_KEY, all);
  }

  appendLeaveAudit({
    requestId: leaveType.id,
    action: "leave_type_deleted",
    detail: `${leaveType.name} (${leaveType.code}) deleted`,
    actor: actor(),
  });
}

export async function createEmployeeLeaveBalance(input: {
  branchId: string;
  employeeId: string;
  leaveTypeId: string;
  balanceYear: number;
  openingBalance?: number;
  accruedDays?: number;
}): Promise<void> {
  await resourceService.create("/hr/leave-balances", {
    branch_id: input.branchId,
    employee_id: input.employeeId,
    leave_type_id: input.leaveTypeId,
    balance_year: input.balanceYear,
    opening_balance: input.openingBalance ?? 0,
    accrued: input.accruedDays ?? 0,
    used: 0,
    status: "open",
  });
  appendLeaveAudit({
    requestId: input.employeeId,
    action: "leave_balance_assigned",
    detail: `Assigned leave type ${input.leaveTypeId} for ${input.balanceYear}`,
    actor: actor(),
  });
}

export async function removeEmployeeLeaveBalance(balanceId: string): Promise<void> {
  await resourceService.delete("/hr/leave-balances", balanceId);
  appendLeaveAudit({
    requestId: balanceId,
    action: "leave_balance_removed",
    detail: `Removed leave balance ${balanceId}`,
    actor: actor(),
  });
}

/** Credit or debit days for a calendar month (posts via leave-adjustments/apply). */
export async function applyLeaveMonthAdjustment(input: {
  branchId: string;
  employeeId: string;
  leaveTypeId: string;
  /** YYYY-MM */
  month: string;
  daysDelta: number;
  reason?: string;
}): Promise<void> {
  const [y, m] = input.month.split("-").map(Number);
  const adjustmentMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  await apiClient("/hr/leave-adjustments/apply", {
    method: "POST",
    body: {
      branch_id: input.branchId,
      employee_id: input.employeeId,
      leave_type_id: input.leaveTypeId,
      adjustment_month: adjustmentMonth,
      days_delta: input.daysDelta,
      reason: input.reason ?? null,
    },
  });
  appendLeaveAudit({
    requestId: input.employeeId,
    action: "leave_month_adjustment",
    detail: `${input.month}: ${input.daysDelta > 0 ? "+" : ""}${input.daysDelta}d (${input.leaveTypeId})`,
    actor: actor(),
  });
}
