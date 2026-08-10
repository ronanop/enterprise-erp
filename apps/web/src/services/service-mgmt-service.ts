import { ApiClientError, resourceService } from "@/services/api-client";

export type ServiceRow = Record<string, unknown>;

export type ServiceOverview = {
  requestTickets: ServiceRow[];
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
  const requestTickets = await safeList("/service/service-request-tickets");

  const errors = requestTickets.error ? [requestTickets.error] : [];
  const statusCodes = requestTickets.status ? [requestTickets.status] : [];

  return {
    requestTickets: requestTickets.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
