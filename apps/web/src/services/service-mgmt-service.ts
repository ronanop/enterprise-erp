import { ApiClientError, resourceService } from "@/services/api-client";

export type ServiceRow = Record<string, unknown>;

export type ServiceOverview = {
  categories: ServiceRow[];
  requests: ServiceRow[];
  tickets: ServiceRow[];
  assignments: ServiceRow[];
  schedules: ServiceRow[];
  workOrders: ServiceRow[];
  tasks: ServiceRow[];
  visits: ServiceRow[];
  materials: ServiceRow[];
  timeEntries: ServiceRow[];
  slas: ServiceRow[];
  escalations: ServiceRow[];
  contracts: ServiceRow[];
  feedback: ServiceRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): ServiceRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is ServiceRow => !!row && typeof row === "object",
    );
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: ServiceRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function countByStatus(rows: ServiceRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: ServiceRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadServiceOverview(): Promise<ServiceOverview> {
  const [
    categories,
    requests,
    tickets,
    assignments,
    schedules,
    workOrders,
    tasks,
    visits,
    materials,
    timeEntries,
    slas,
    escalations,
    contracts,
    feedback,
  ] = await Promise.all([
    safeList("/service/service-categories"),
    safeList("/service/service-requests"),
    safeList("/service/service-tickets"),
    safeList("/service/service-assignments"),
    safeList("/service/service-schedules"),
    safeList("/service/work-orders"),
    safeList("/service/service-tasks"),
    safeList("/service/service-visits"),
    safeList("/service/service-materials"),
    safeList("/service/time-entries"),
    safeList("/service/service-slas"),
    safeList("/service/service-escalations"),
    safeList("/service/service-contracts"),
    safeList("/service/service-feedback"),
  ]);

  const results = [
    categories,
    requests,
    tickets,
    assignments,
    schedules,
    workOrders,
    tasks,
    visits,
    materials,
    timeEntries,
    slas,
    escalations,
    contracts,
    feedback,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    categories: categories.rows,
    requests: requests.rows,
    tickets: tickets.rows,
    assignments: assignments.rows,
    schedules: schedules.rows,
    workOrders: workOrders.rows,
    tasks: tasks.rows,
    visits: visits.rows,
    materials: materials.rows,
    timeEntries: timeEntries.rows,
    slas: slas.rows,
    escalations: escalations.rows,
    contracts: contracts.rows,
    feedback: feedback.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
