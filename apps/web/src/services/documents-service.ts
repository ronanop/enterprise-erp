import { ApiClientError, resourceService } from "@/services/api-client";

export type DocumentsRow = Record<string, unknown>;

export type DocumentsOverview = {
  folders: DocumentsRow[];
  documents: DocumentsRow[];
  versions: DocumentsRow[];
  tags: DocumentsRow[];
  permissions: DocumentsRow[];
  shares: DocumentsRow[];
  approvals: DocumentsRow[];
  workflows: DocumentsRow[];
  templates: DocumentsRow[];
  retentionPolicies: DocumentsRow[];
  archives: DocumentsRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): DocumentsRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is DocumentsRow => !!row && typeof row === "object",
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
): Promise<{ rows: DocumentsRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: DocumentsRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: DocumentsRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadDocumentsOverview(): Promise<DocumentsOverview> {
  const [
    folders,
    documents,
    versions,
    tags,
    permissions,
    shares,
    approvals,
    workflows,
    templates,
    retentionPolicies,
    archives,
  ] = await Promise.all([
    safeList("/documents/folders"),
    safeList("/documents/documents"),
    safeList("/documents/document-versions"),
    safeList("/documents/document-tags"),
    safeList("/documents/document-permissions"),
    safeList("/documents/document-shares"),
    safeList("/documents/document-approvals"),
    safeList("/documents/document-workflows"),
    safeList("/documents/templates"),
    safeList("/documents/retention-policies"),
    safeList("/documents/archives"),
  ]);

  const results = [
    folders,
    documents,
    versions,
    tags,
    permissions,
    shares,
    approvals,
    workflows,
    templates,
    retentionPolicies,
    archives,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    folders: folders.rows,
    documents: documents.rows,
    versions: versions.rows,
    tags: tags.rows,
    permissions: permissions.rows,
    shares: shares.rows,
    approvals: approvals.rows,
    workflows: workflows.rows,
    templates: templates.rows,
    retentionPolicies: retentionPolicies.rows,
    archives: archives.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
