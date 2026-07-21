import { ApiClientError, resourceService } from "@/services/api-client";

export type ProjectsRow = Record<string, unknown>;

export type ProjectsOverview = {
  projects: ProjectsRow[];
  phases: ProjectsRow[];
  milestones: ProjectsRow[];
  tasks: ProjectsRow[];
  timesheets: ProjectsRow[];
  timesheetEntries: ProjectsRow[];
  resourcePlans: ProjectsRow[];
  resourceAllocations: ProjectsRow[];
  budgets: ProjectsRow[];
  costs: ProjectsRow[];
  issues: ProjectsRow[];
  risks: ProjectsRow[];
  changeRequests: ProjectsRow[];
  documents: ProjectsRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): ProjectsRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is ProjectsRow => !!row && typeof row === "object",
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
): Promise<{ rows: ProjectsRow[]; error?: string; status?: number }> {
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

export function sumField(rows: ProjectsRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: ProjectsRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: ProjectsRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadProjectsOverview(): Promise<ProjectsOverview> {
  const [
    projects,
    phases,
    milestones,
    tasks,
    timesheets,
    timesheetEntries,
    resourcePlans,
    resourceAllocations,
    budgets,
    costs,
    issues,
    risks,
    changeRequests,
    documents,
  ] = await Promise.all([
    safeList("/projects/projects"),
    safeList("/projects/project-phases"),
    safeList("/projects/project-milestones"),
    safeList("/projects/project-tasks"),
    safeList("/projects/timesheets"),
    safeList("/projects/timesheet-entries"),
    safeList("/projects/resource-plans"),
    safeList("/projects/resource-allocations"),
    safeList("/projects/project-budgets"),
    safeList("/projects/project-costs"),
    safeList("/projects/project-issues"),
    safeList("/projects/project-risks"),
    safeList("/projects/change-requests"),
    safeList("/projects/project-documents"),
  ]);

  const results = [
    projects,
    phases,
    milestones,
    tasks,
    timesheets,
    timesheetEntries,
    resourcePlans,
    resourceAllocations,
    budgets,
    costs,
    issues,
    risks,
    changeRequests,
    documents,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    projects: projects.rows,
    phases: phases.rows,
    milestones: milestones.rows,
    tasks: tasks.rows,
    timesheets: timesheets.rows,
    timesheetEntries: timesheetEntries.rows,
    resourcePlans: resourcePlans.rows,
    resourceAllocations: resourceAllocations.rows,
    budgets: budgets.rows,
    costs: costs.rows,
    issues: issues.rows,
    risks: risks.rows,
    changeRequests: changeRequests.rows,
    documents: documents.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
