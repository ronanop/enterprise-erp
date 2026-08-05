import { cachedFetch, invalidateClientCache } from "@/lib/client-cache";
import { ApiClientError, resourceService } from "@/services/api-client";

export type CrmRow = Record<string, unknown>;

export type CrmOverview = {
  leadSources: CrmRow[];
  leads: CrmRow[];
  leadAssignments: CrmRow[];
  leadActivities: CrmRow[];
  pipelines: CrmRow[];
  opportunities: CrmRow[];
  opportunityStages: CrmRow[];
  campaigns: CrmRow[];
  interactions: CrmRow[];
  tasks: CrmRow[];
  followups: CrmRow[];
  meetings: CrmRow[];
  callLogs: CrmRow[];
  emailLogs: CrmRow[];
  visitLogs: CrmRow[];
  feedback: CrmRow[];
  satisfaction: CrmRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): CrmRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is CrmRow => !!row && typeof row === "object");
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
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<{ rows: CrmRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath, {
      page: 1,
      page_size: 200,
      ...query,
    });
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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

export function sumField(rows: CrmRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: CrmRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countByStage(rows: CrmRow[], stages: string[]): number {
  const set = new Set(stages.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.current_stage))).length;
}

export function countOpenDocs(rows: CrmRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function leadDisplayName(row: CrmRow): string {
  const first = typeof row.first_name === "string" ? row.first_name : "";
  const last = typeof row.last_name === "string" ? row.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || String(row.lead_code ?? "—");
}

export async function loadCrmOverview(force = false): Promise<CrmOverview> {
  if (force) invalidateClientCache("crm:overview");
  return cachedFetch("crm:overview", 30_000, async () => {
    const [
      leads,
      opportunities,
      tasks,
      followups,
      meetings,
      campaigns,
      pipelines,
    ] = await Promise.all([
      safeList("/crm/leads"),
      safeList("/crm/opportunities"),
      safeList("/crm/tasks"),
      safeList("/crm/followups"),
      safeList("/crm/meetings"),
      safeList("/crm/campaigns"),
      safeList("/crm/pipelines"),
    ]);

    const results = [leads, opportunities, tasks, followups, meetings, campaigns, pipelines];
    const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
    const statusCodes = results
      .map((r) => r.status)
      .filter((s): s is number => typeof s === "number");

    return {
      leadSources: [],
      leads: leads.rows,
      leadAssignments: [],
      leadActivities: [],
      pipelines: pipelines.rows,
      opportunities: opportunities.rows,
      opportunityStages: [],
      campaigns: campaigns.rows,
      interactions: [],
      tasks: tasks.rows,
      followups: followups.rows,
      meetings: meetings.rows,
      callLogs: [],
      emailLogs: [],
      visitLogs: [],
      feedback: [],
      satisfaction: [],
      errors,
      statusCodes,
      partial: errors.length > 0,
    };
  });
}
