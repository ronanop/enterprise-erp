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
): Promise<{ rows: CrmRow[]; error?: string; status?: number }> {
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

export async function loadCrmOverview(): Promise<CrmOverview> {
  const [
    leadSources,
    leads,
    leadAssignments,
    leadActivities,
    pipelines,
    opportunities,
    opportunityStages,
    campaigns,
    interactions,
    tasks,
    followups,
    meetings,
    callLogs,
    emailLogs,
    visitLogs,
    feedback,
    satisfaction,
  ] = await Promise.all([
    safeList("/crm/lead-sources"),
    safeList("/crm/leads"),
    safeList("/crm/lead-assignments"),
    safeList("/crm/lead-activities"),
    safeList("/crm/pipelines"),
    safeList("/crm/opportunities"),
    safeList("/crm/opportunity-stages"),
    safeList("/crm/campaigns"),
    safeList("/crm/interactions"),
    safeList("/crm/tasks"),
    safeList("/crm/followups"),
    safeList("/crm/meetings"),
    safeList("/crm/call-logs"),
    safeList("/crm/email-logs"),
    safeList("/crm/visit-logs"),
    safeList("/crm/customer-feedback"),
    safeList("/crm/customer-satisfaction"),
  ]);

  const results = [
    leadSources,
    leads,
    leadAssignments,
    leadActivities,
    pipelines,
    opportunities,
    opportunityStages,
    campaigns,
    interactions,
    tasks,
    followups,
    meetings,
    callLogs,
    emailLogs,
    visitLogs,
    feedback,
    satisfaction,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    leadSources: leadSources.rows,
    leads: leads.rows,
    leadAssignments: leadAssignments.rows,
    leadActivities: leadActivities.rows,
    pipelines: pipelines.rows,
    opportunities: opportunities.rows,
    opportunityStages: opportunityStages.rows,
    campaigns: campaigns.rows,
    interactions: interactions.rows,
    tasks: tasks.rows,
    followups: followups.rows,
    meetings: meetings.rows,
    callLogs: callLogs.rows,
    emailLogs: emailLogs.rows,
    visitLogs: visitLogs.rows,
    feedback: feedback.rows,
    satisfaction: satisfaction.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
