import { ApiClientError, resourceService } from "@/services/api-client";

export type HelpdeskRow = Record<string, unknown>;

export type HelpdeskOverview = {
  categories: HelpdeskRow[];
  priorities: HelpdeskRow[];
  tickets: HelpdeskRow[];
  assignments: HelpdeskRow[];
  comments: HelpdeskRow[];
  slas: HelpdeskRow[];
  escalations: HelpdeskRow[];
  knowledgeBases: HelpdeskRow[];
  articles: HelpdeskRow[];
  resolutions: HelpdeskRow[];
  teams: HelpdeskRow[];
  shifts: HelpdeskRow[];
  schedules: HelpdeskRow[];
  feedback: HelpdeskRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): HelpdeskRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is HelpdeskRow => !!row && typeof row === "object",
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
): Promise<{ rows: HelpdeskRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: HelpdeskRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: HelpdeskRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadHelpdeskOverview(): Promise<HelpdeskOverview> {
  const [
    categories,
    priorities,
    tickets,
    assignments,
    comments,
    slas,
    escalations,
    knowledgeBases,
    articles,
    resolutions,
    teams,
    shifts,
    schedules,
    feedback,
  ] = await Promise.all([
    safeList("/helpdesk/ticket-categories"),
    safeList("/helpdesk/ticket-priorities"),
    safeList("/helpdesk/tickets"),
    safeList("/helpdesk/ticket-assignments"),
    safeList("/helpdesk/ticket-comments"),
    safeList("/helpdesk/ticket-slas"),
    safeList("/helpdesk/ticket-escalations"),
    safeList("/helpdesk/knowledge-bases"),
    safeList("/helpdesk/knowledge-articles"),
    safeList("/helpdesk/resolutions"),
    safeList("/helpdesk/support-teams"),
    safeList("/helpdesk/support-shifts"),
    safeList("/helpdesk/support-schedules"),
    safeList("/helpdesk/customer-feedback"),
  ]);

  const results = [
    categories,
    priorities,
    tickets,
    assignments,
    comments,
    slas,
    escalations,
    knowledgeBases,
    articles,
    resolutions,
    teams,
    shifts,
    schedules,
    feedback,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    categories: categories.rows,
    priorities: priorities.rows,
    tickets: tickets.rows,
    assignments: assignments.rows,
    comments: comments.rows,
    slas: slas.rows,
    escalations: escalations.rows,
    knowledgeBases: knowledgeBases.rows,
    articles: articles.rows,
    resolutions: resolutions.rows,
    teams: teams.rows,
    shifts: shifts.rows,
    schedules: schedules.rows,
    feedback: feedback.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
