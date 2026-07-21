import { ApiClientError, resourceService } from "@/services/api-client";

export type PortalRow = Record<string, unknown>;

export type PortalOverview = {
  accounts: PortalRow[];
  profiles: PortalRow[];
  sessions: PortalRow[];
  dashboards: PortalRow[];
  notifications: PortalRow[];
  threads: PortalRow[];
  orderViews: PortalRow[];
  invoiceViews: PortalRow[];
  documentAccess: PortalRow[];
  tickets: PortalRow[];
  serviceRequests: PortalRow[];
  preferences: PortalRow[];
  loginAudits: PortalRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): PortalRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is PortalRow => !!row && typeof row === "object",
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
): Promise<{ rows: PortalRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: PortalRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: PortalRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadPortalOverview(): Promise<PortalOverview> {
  const [
    accounts,
    profiles,
    sessions,
    dashboards,
    notifications,
    threads,
    orderViews,
    invoiceViews,
    documentAccess,
    tickets,
    serviceRequests,
    preferences,
    loginAudits,
  ] = await Promise.all([
    safeList("/portal/portal-accounts"),
    safeList("/portal/customer-profiles"),
    safeList("/portal/portal-sessions"),
    safeList("/portal/dashboards"),
    safeList("/portal/notifications"),
    safeList("/portal/message-threads"),
    safeList("/portal/order-views"),
    safeList("/portal/invoice-views"),
    safeList("/portal/document-accesses"),
    safeList("/portal/support-tickets"),
    safeList("/portal/service-requests"),
    safeList("/portal/preferences"),
    safeList("/portal/login-audits"),
  ]);

  const results = [
    accounts,
    profiles,
    sessions,
    dashboards,
    notifications,
    threads,
    orderViews,
    invoiceViews,
    documentAccess,
    tickets,
    serviceRequests,
    preferences,
    loginAudits,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    accounts: accounts.rows,
    profiles: profiles.rows,
    sessions: sessions.rows,
    dashboards: dashboards.rows,
    notifications: notifications.rows,
    threads: threads.rows,
    orderViews: orderViews.rows,
    invoiceViews: invoiceViews.rows,
    documentAccess: documentAccess.rows,
    tickets: tickets.rows,
    serviceRequests: serviceRequests.rows,
    preferences: preferences.rows,
    loginAudits: loginAudits.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
