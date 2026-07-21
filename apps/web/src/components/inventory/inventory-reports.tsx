"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inventoryReportTabs, type InventoryReportTab } from "@/config/inventory";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  asNumber,
  formatQty,
  loadInventoryReport,
  type InventoryRow,
} from "@/services/inventory-service";

type ReportKey = InventoryReportTab["key"];

function reportColumns(tab: ReportKey): { key: string; label: string; align?: "right" }[] {
  if (tab === "stock-summary") {
    return [
      { key: "product_id", label: "Product" },
      { key: "warehouse_id", label: "Warehouse" },
      { key: "on_hand_qty", label: "On hand", align: "right" },
      { key: "available_qty", label: "Available", align: "right" },
    ];
  }
  return [
    { key: "batch_number", label: "Batch" },
    { key: "product_id", label: "Product" },
    { key: "expiry_date", label: "Expiry" },
    { key: "quantity", label: "Qty", align: "right" },
    { key: "status", label: "Status" },
  ];
}

function shortId(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value);
  if (/^[0-9a-f-]{36}$/i.test(s)) return `${s.slice(0, 8)}…`;
  return s;
}

function formatCell(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key.includes("qty") || key.includes("quantity")) return formatQty(asNumber(value));
  if (key.endsWith("_id")) return shortId(value);
  return String(value);
}

export function InventoryReports() {
  const [tab, setTab] = useState<ReportKey>("stock-summary");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [reportName, setReportName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const active = inventoryReportTabs.find((t) => t.key === tab) ?? inventoryReportTabs[0];
  const columns = useMemo(() => {
    const preferred = reportColumns(tab);
    if (rows.length === 0) return preferred;
    const keys = Object.keys(rows[0]);
    const matched = preferred.filter((c) => keys.includes(c.key));
    if (matched.length > 0) return matched;
    return keys.slice(0, 6).map((key) => ({
      key,
      label: key.replaceAll("_", " "),
      align: key.includes("qty") || key.includes("quantity") ? ("right" as const) : undefined,
    }));
  }, [tab, rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data = await loadInventoryReport(active.apiPath);
      setRows(data.rows);
      setReportName(data.name ?? null);
    } catch (err) {
      setRows([]);
      setReportName(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load report");
      setStatus(err instanceof ApiClientError ? err.status : null);
    } finally {
      setLoading(false);
    }
  }, [active.apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory reports"
        description="Stock summary and batch expiry — generated from live warehouse balances."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/inventory"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Back to Inventory
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {inventoryReportTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
              tab === item.key
                ? "border-primary/30 bg-primary text-primary-foreground"
                : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium tracking-tight">
                {reportName ?? active.title}
              </h2>
              <Badge variant="secondary">{rows.length} lines</Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{active.description}</p>
          </div>
          <code className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            {active.apiPath}
          </code>
        </div>

        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Generating report…</p>
        ) : null}

        {!loading && error ? (
          <div className="m-4 space-y-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-4 py-6">
            <p className="text-sm font-medium text-destructive">
              {status === 401 ? "Authentication required" : "Unable to load report"}
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            {status === 401 || !authenticated ? (
              <Link
                href="/login"
                className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                Sign in to continue
              </Link>
            ) : null}
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn("px-4 py-2.5 font-medium", col.align === "right" && "text-right")}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No lines returned for this report.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-2.5",
                            col.align === "right" && "text-right font-mono text-xs tabular-nums",
                            col.key.includes("qty") || col.key.includes("quantity")
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatCell(col.key, row[col.key])}
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
  );
}
