import { ApiClientError, resourceService } from "@/services/api-client";

export type IntegrationRow = Record<string, unknown>;

export type IntegrationOverview = {
  systems: IntegrationRow[];
  connectors: IntegrationRow[];
  credentials: IntegrationRow[];
  oauthClients: IntegrationRow[];
  webhooks: IntegrationRow[];
  events: IntegrationRow[];
  queues: IntegrationRow[];
  retries: IntegrationRow[];
  deadLetters: IntegrationRow[];
  mappings: IntegrationRow[];
  syncJobs: IntegrationRow[];
  syncLogs: IntegrationRow[];
  rateLimits: IntegrationRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): IntegrationRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is IntegrationRow => !!row && typeof row === "object",
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
): Promise<{ rows: IntegrationRow[]; error?: string; status?: number }> {
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

export function countByStatus(
  rows: IntegrationRow[],
  statuses: string[],
): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: IntegrationRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadIntegrationOverview(): Promise<IntegrationOverview> {
  const [
    systems,
    connectors,
    credentials,
    oauthClients,
    webhooks,
    events,
    queues,
    retries,
    deadLetters,
    mappings,
    syncJobs,
    syncLogs,
    rateLimits,
  ] = await Promise.all([
    safeList("/integration/external-systems"),
    safeList("/integration/connectors"),
    safeList("/integration/api-credentials"),
    safeList("/integration/oauth-clients"),
    safeList("/integration/webhooks"),
    safeList("/integration/event-definitions"),
    safeList("/integration/message-queues"),
    safeList("/integration/retry-queues"),
    safeList("/integration/dead-letters"),
    safeList("/integration/data-mappings"),
    safeList("/integration/sync-jobs"),
    safeList("/integration/sync-logs"),
    safeList("/integration/rate-limits"),
  ]);

  const results = [
    systems,
    connectors,
    credentials,
    oauthClients,
    webhooks,
    events,
    queues,
    retries,
    deadLetters,
    mappings,
    syncJobs,
    syncLogs,
    rateLimits,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    systems: systems.rows,
    connectors: connectors.rows,
    credentials: credentials.rows,
    oauthClients: oauthClients.rows,
    webhooks: webhooks.rows,
    events: events.rows,
    queues: queues.rows,
    retries: retries.rows,
    deadLetters: deadLetters.rows,
    mappings: mappings.rows,
    syncJobs: syncJobs.rows,
    syncLogs: syncLogs.rows,
    rateLimits: rateLimits.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
