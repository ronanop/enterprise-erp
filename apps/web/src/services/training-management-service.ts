import { resourceService } from "@/services/api-client";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { HrRow } from "@/services/hr-service";
import type {
  TrainingNotification,
  TrainingProgram,
  TrainingRequest,
  TrainingRoom,
} from "@/types/training-management";

const NOTIF_KEY = "erp_training_notifications_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

async function listAll(apiPath: string): Promise<HrRow[]> {
  const all: HrRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await resourceService.list(apiPath, { page, page_size: 200 }).catch(() => ({ data: [] }));
    const rows = (Array.isArray(res.data) ? res.data : []) as HrRow[];
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all;
}

function asTime(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export type TrainingDirectory = {
  programs: TrainingProgram[];
  rooms: TrainingRoom[];
  requests: TrainingRequest[];
  attendance: HrRow[];
  options: {
    branches: { id: string; label: string }[];
    employees: { id: string; label: string; code: string; branchId: string }[];
  };
  notifications: TrainingNotification[];
};

export function listTrainingNotifications(): TrainingNotification[] {
  return readJson<TrainingNotification[]>(NOTIF_KEY, []);
}

export function queueTrainingNotifications(
  entries: Omit<TrainingNotification, "id" | "at" | "read">[],
): void {
  const all = listTrainingNotifications();
  const now = new Date().toISOString();
  for (const e of entries) {
    all.unshift({
      ...e,
      id: crypto.randomUUID(),
      read: false,
      at: now,
    });
  }
  writeJson(NOTIF_KEY, all.slice(0, 500));
}

export function markTrainingNotificationsRead(ids?: string[]): void {
  const all = listTrainingNotifications().map((n) =>
    !ids || ids.includes(n.id) ? { ...n, read: true } : n,
  );
  writeJson(NOTIF_KEY, all);
}

export async function loadTrainingDirectory(): Promise<TrainingDirectory> {
  const [programs, rooms, requests, attendance, branches, empDir] = await Promise.all([
    listAll("/hr/training"),
    listAll("/hr/training-rooms"),
    listAll("/hr/training-requests"),
    listAll("/hr/training-attendance"),
    listAll("/branches"),
    loadEmployeeDirectory().catch(() => ({
      records: [],
      options: { branches: [], departments: [], designations: [], managers: [], shifts: [] },
      errors: [],
    })),
  ]);

  const roomMap = new Map(
    rooms.map((r) => [String(r.id), String(r.room_name ?? r.room_code ?? r.id)]),
  );
  const attendeeCount = new Map<string, number>();
  for (const a of attendance) {
    const tid = String(a.training_id);
    attendeeCount.set(tid, (attendeeCount.get(tid) ?? 0) + 1);
  }

  return {
    programs: programs.map((row) => ({
      id: String(row.id),
      code: String(row.training_code ?? ""),
      name: String(row.training_name ?? ""),
      type: String(row.training_type ?? ""),
      hostName: String(row.trainer_name ?? "—"),
      hostEmployeeId: String(row.trainer_employee_id ?? ""),
      startDate: String(row.start_date ?? ""),
      endDate: String(row.end_date ?? ""),
      startTime: asTime(row.start_time),
      endTime: asTime(row.end_time),
      roomId: String(row.room_id ?? ""),
      roomName: roomMap.get(String(row.room_id ?? "")) ?? "—",
      isRecurring: Boolean(row.is_recurring),
      recurrenceRule: String(row.recurrence_rule ?? "none"),
      notes: String(row.notes ?? ""),
      status: String(row.status ?? "planned"),
      version: Number(row.version ?? 1),
      attendeeCount: attendeeCount.get(String(row.id)) ?? 0,
    })),
    rooms: rooms.map((row) => ({
      id: String(row.id),
      code: String(row.room_code ?? ""),
      name: String(row.room_name ?? ""),
      capacity: Number(row.capacity ?? 0),
      equipment: Array.isArray(row.equipment_json)
        ? (row.equipment_json as unknown[]).map((item) => {
            if (item && typeof item === "object" && "name" in item) {
              const o = item as Record<string, unknown>;
              const name = String(o.name ?? "").trim();
              const remarks = String(o.remarks ?? "").trim();
              const serial = String(o.serial ?? o.serial_number ?? "").trim();
              if (!name) return "";
              let s = name;
              if (remarks) s += ` (${remarks})`;
              if (serial) s += ` · ${serial}`;
              return s;
            }
            return String(item).trim();
          }).filter(Boolean)
        : [],
      notes: String(row.notes ?? ""),
      status: String(row.status ?? "active"),
      version: Number(row.version ?? 1),
      branchId: String(row.branch_id ?? ""),
    })),
    requests: requests.map((row) => {
      const attendeesRaw = Array.isArray(row.attendees_json) ? row.attendees_json : [];
      return {
        id: String(row.id),
        code: String(row.request_code ?? ""),
        title: String(row.title ?? ""),
        requestType: String(row.request_type ?? "meeting"),
        requestedByEmployeeId: String(row.requested_by_employee_id ?? ""),
        hostEmployeeId: String(row.host_employee_id ?? ""),
        hostName: String(row.host_name ?? "—"),
        roomId: String(row.room_id ?? ""),
        roomName: roomMap.get(String(row.room_id ?? "")) ?? "—",
        requestDate: String(row.request_date ?? ""),
        startTime: asTime(row.start_time),
        endTime: asTime(row.end_time),
        isRecurring: Boolean(row.is_recurring),
        recurrenceRule: String(row.recurrence_rule ?? ""),
        attendees: attendeesRaw.map((a) => {
          const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
          return {
            employeeId: String(o.employee_id ?? ""),
            employeeName: String(o.employee_name ?? "—"),
            employeeCode: String(o.employee_code ?? ""),
          };
        }),
        agenda: String(row.agenda ?? ""),
        approvalNotes: String(row.approval_notes ?? ""),
        status: String(row.status ?? "submitted"),
        trainingId: String(row.training_id ?? ""),
        version: Number(row.version ?? 1),
        branchId: String(row.branch_id ?? ""),
      };
    }),
    attendance,
    options: {
      branches: branches.map((b) => ({
        id: String(b.id),
        label: String(b.branch_name ?? b.name ?? b.branch_code ?? b.id),
      })),
      employees: empDir.records.map((e) => ({
        id: e.id,
        label: e.displayName,
        code: e.employeeCode,
        branchId: e.branchId,
      })),
    },
    notifications: listTrainingNotifications(),
  };
}

export async function createTrainingRoom(input: {
  branchId?: string;
  name: string;
  capacity: number;
  equipment: string[];
  notes?: string;
}): Promise<void> {
  await resourceService.create("/hr/training-rooms", {
    branch_id: input.branchId || null,
    room_name: input.name,
    capacity: input.capacity,
    equipment_json: input.equipment,
    notes: input.notes || null,
    status: "active",
  });
}

export async function createTrainingProgram(input: {
  branchId: string;
  name: string;
  type: string;
  hostEmployeeId: string;
  hostName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  roomId: string;
  isRecurring: boolean;
  recurrenceRule: string;
  notes: string;
  employeeIds: string[];
  employeeLabels: { id: string; label: string }[];
}): Promise<void> {
  await resourceService.create("/hr/training", {
    branch_id: input.branchId || null,
    training_name: input.name,
    training_type: input.type,
    trainer_employee_id: input.hostEmployeeId || null,
    trainer_name: input.hostName || null,
    start_date: input.startDate || null,
    end_date: input.endDate || input.startDate || null,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    room_id: input.roomId || null,
    is_recurring: input.isRecurring,
    recurrence_rule: input.isRecurring ? input.recurrenceRule : "none",
    notes: input.notes || null,
    status: "planned",
    employee_ids: input.employeeIds,
  });

  if (input.startDate && input.employeeLabels.length) {
    queueTrainingNotifications(
      input.employeeLabels.map((e) => ({
        employeeId: e.id,
        employeeName: e.label,
        trainingId: "",
        trainingName: input.name,
        date: input.startDate,
        time: input.startTime,
        message: `You are enrolled in "${input.name}" on ${input.startDate}${
          input.startTime ? ` at ${input.startTime}` : ""
        }.`,
      })),
    );
  }
}

export async function createMeetingRequest(input: {
  branchId: string;
  title: string;
  requestType: string;
  requestedByEmployeeId: string;
  hostEmployeeId: string;
  hostName: string;
  roomId: string;
  requestDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceRule: string;
  agenda: string;
  attendees: { employeeId: string; employeeName: string; employeeCode: string }[];
}): Promise<void> {
  await resourceService.create("/hr/training-requests", {
    branch_id: input.branchId,
    title: input.title,
    request_type: input.requestType,
    requested_by_employee_id: input.requestedByEmployeeId,
    host_employee_id: input.hostEmployeeId || null,
    host_name: input.hostName || null,
    room_id: input.roomId || null,
    request_date: input.requestDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    is_recurring: input.isRecurring,
    recurrence_rule: input.isRecurring ? input.recurrenceRule : null,
    agenda: input.agenda || null,
    attendees: input.attendees.map((a) => ({
      employee_id: a.employeeId,
      employee_name: a.employeeName,
      employee_code: a.employeeCode,
    })),
  });
}

export async function decideMeetingRequest(
  id: string,
  action: "approve" | "reject",
  notes?: string,
): Promise<void> {
  await resourceService.action(`/hr/training-requests`, id, action, {
    approval_notes: notes || null,
  });
}
