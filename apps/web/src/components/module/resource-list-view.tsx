"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError, resourceService } from "@/services/api-client";

interface ResourceListViewProps {
  moduleKey: string;
  moduleTitle: string;
  title: string;
  description: string;
  apiPath: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REF_KEYS = new Set([
  "document_number",
  "entry_number",
  "register_number",
  "message_number",
  "retry_number",
  "dlq_number",
  "journal_number",
  "request_number",
  "channel_number",
]);

function normalizeRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "records", "data", "nodes", "tree"]) {
      if (Array.isArray(obj[key])) {
        return normalizeRows(obj[key]);
      }
    }
    return [obj];
  }
  return [];
}

function isUuidLike(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

function isHiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  if (k === "id" || k === "version" || k === "tenant_id") return true;
  if (k.endsWith("_id") || k.endsWith("_ids")) return true;
  if (k.includes("password") || k.includes("secret") || k.includes("token")) return true;
  if (k.endsWith("_json") || k === "metadata" || k === "config_json" || k === "score_breakdown")
    return true;
  return false;
}

function scoreColumn(key: string, sample: unknown): number {
  const k = key.toLowerCase();
  if (isHiddenKey(k)) return -100;
  if (isUuidLike(sample)) return -50;

  let score = 0;
  if (/(^|_)(name|title|subject|label)$/.test(k)) score += 100;
  else if (k.includes("name") || k.includes("title") || k.includes("subject")) score += 90;
  else if (REF_KEYS.has(k) || /(^|_)(code|number)$/.test(k) || k.endsWith("_code") || k.endsWith("_number"))
    score += 95;
  else if (k.includes("email") || k.includes("mobile") || k.includes("phone")) score += 70;
  else if (k === "status" || k.endsWith("_status") || k === "priority" || k === "type" || k === "level")
    score += 60;
  else if (
    k.includes("amount") ||
    k.includes("salary") ||
    k.includes("gross") ||
    k.includes("net") ||
    k.includes("qty") ||
    k.includes("quantity") ||
    k.includes("cost") ||
    k.includes("total")
  )
    score += 55;
  else if (k.includes("date") || k.includes("message")) score += 40;
  else if (typeof sample === "string" && sample.length > 0 && sample.length < 80) score += 25;
  else if (typeof sample === "number" || typeof sample === "boolean") score += 10;
  else score += 1;

  return score;
}

function humanizeHeader(key: string): string {
  const k = key.toLowerCase();
  if (REF_KEYS.has(k)) return "Ref";
  if (k.endsWith("_code") || k === "code") return "Code";
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "ID");
}

function pickColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const ranked = keys
    .map((key) => ({ key, score: scoreColumn(key, rows[0][key]) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  const selected = ranked.slice(0, 7).map((x) => x.key);
  if (selected.length >= 2) return selected;

  return keys
    .filter((k) => {
      const v = rows[0][k];
      if (v != null && typeof v === "object") return false;
      if (isHiddenKey(k) || isUuidLike(v)) return false;
      return true;
    })
    .slice(0, 6);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCell(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const k = key.toLowerCase();
    if (
      k.includes("amount") ||
      k.includes("salary") ||
      k.includes("gross") ||
      k.includes("net") ||
      k.includes("deduction") ||
      k.includes("cost") ||
      (k.includes("total") && !k.includes("count"))
    ) {
      return formatMoney(value);
    }
    if (k.includes("qty") || k.includes("quantity") || k.includes("rate")) {
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
    }
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) return `${value.length} items`;
    return "—";
  }
  const s = String(value);
  if (UUID_RE.test(s)) return "—";
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("en-IN");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length > 48) return `${s.slice(0, 45)}…`;
  return s;
}

function displayLabel(row: Record<string, unknown>): string {
  const candidates = [
    "full_name",
    "employee_name",
    "customer_name",
    "vendor_name",
    "product_name",
    "project_name",
    "asset_name",
    "account_name",
    "dashboard_name",
    "store_name",
    "policy_name",
    "folder_name",
    "display_name",
    "first_name",
    "name",
    "title",
    "subject",
    "document_number",
    "entry_number",
    "register_number",
    "code",
  ];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim() && !UUID_RE.test(v)) {
      if (key === "first_name" && typeof row.last_name === "string") {
        return `${v} ${row.last_name}`.trim();
      }
      return v;
    }
  }
  if (typeof row.first_name === "string" && typeof row.last_name === "string") {
    const n = `${row.first_name} ${row.last_name}`.trim();
    if (n) return n;
  }
  return "";
}

export function ResourceListView({
  moduleKey,
  moduleTitle,
  title,
  description,
  apiPath,
}: ResourceListViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await resourceService.list(apiPath);
      setRows(normalizeRows(response.data));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load resource";
      const code = err instanceof ApiClientError ? err.status : null;
      setError(message);
      setStatus(code);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const enrichedRows = useMemo(() => {
    return rows.map((row) => {
      const label = displayLabel(row);
      if (!label) return row;
      if (!("name" in row) && !("full_name" in row) && !("title" in row) && !("subject" in row)) {
        return { name: label, ...row };
      }
      return row;
    });
  }, [rows]);

  const columns = useMemo(() => pickColumns(enrichedRows), [enrichedRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrichedRows;
    return enrichedRows.filter((row) =>
      Object.entries(row).some(([k, v]) => {
        if (isHiddenKey(k) || isUuidLike(v)) return false;
        return formatCell(k, v).toLowerCase().includes(q);
      }),
    );
  }, [enrichedRows, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="shadow-none" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href={`/${moduleKey}`}
              className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Back to {moduleTitle}
            </Link>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium tracking-tight">Records</h2>
              <Badge variant="secondary">{filtered.length} shown</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Live data from <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{apiPath}</code>
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}…`}
            className="h-9 max-w-xs shadow-none"
          />
        </div>

        <div className="px-0 py-0">
          {loading ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Loading records…</p>
          ) : null}

          {!loading && error ? (
            <div className="m-4 space-y-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-4 py-6 sm:m-5">
              <p className="text-sm font-medium text-destructive">
                {status === 401
                  ? "Authentication required"
                  : status === 403
                    ? "Permission denied"
                    : "Unable to load records"}
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
              {status === 401 || !authenticated ? (
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  Sign in to continue
                </Link>
              ) : null}
              {status === 403 && authenticated ? (
                <p className="text-sm text-muted-foreground">
                  Your role is missing this permission. Sign out and sign back in as{" "}
                  <code className="rounded bg-muted px-1">admin@example.com</code>.
                </p>
              ) : null}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {columns.length > 0 ? (
                      columns.map((col) => (
                        <th key={col} className="px-5 py-3 font-medium">
                          {humanizeHeader(col)}
                        </th>
                      ))
                    ) : (
                      <th className="px-5 py-3 font-medium">Result</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(columns.length, 1)}
                        className="px-5 py-12 text-center text-muted-foreground"
                      >
                        No records returned from {apiPath}.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => (
                      <tr
                        key={String(row.id ?? idx)}
                        className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
                      >
                        {columns.map((col, colIdx) => (
                          <td
                            key={col}
                            className={`max-w-[260px] truncate px-5 py-3 ${
                              colIdx === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                            }`}
                            title={formatCell(col, row[col])}
                          >
                            {formatCell(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
