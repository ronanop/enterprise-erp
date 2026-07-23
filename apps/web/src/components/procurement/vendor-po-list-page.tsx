"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDot, PackageCheck, RefreshCw, ShoppingCart } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  formatInr,
  listVendorOptions,
  listVendorPos,
  type ScmVendorPo,
  type VendorOption,
} from "@/services/procurement-service";

function grnTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "closed" || status === "delivered") return "default";
  if (status === "partial") return "secondary";
  return "outline";
}

export function VendorPoListPage() {
  const [rows, setRows] = useState<ScmVendorPo[]>([]);
  const [vendors, setVendors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "partial" | "closed">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pos, vendorRows] = await Promise.all([
        listVendorPos(),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setRows(pos);
      setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, v.label])));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load vendor POs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.grn_status === filter);
  }, [rows, filter]);

  const kpis = useMemo(() => {
    return {
      total: rows.length,
      pending: rows.filter((r) => r.grn_status === "pending").length,
      partial: rows.filter((r) => r.grn_status === "partial").length,
      closed: rows.filter((r) => r.grn_status === "closed").length,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors & PO"
        description="Vendor purchase orders with goods receipt (GRN) progress."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/procurement/scm"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              SCM Queue
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard label="All POs" value={String(kpis.total)} icon={ShoppingCart} />
        <FinanceKpiCard
          label="GRN pending"
          value={String(kpis.pending)}
          tone="warning"
          icon={CircleDot}
        />
        <FinanceKpiCard label="GRN partial" value={String(kpis.partial)} icon={CircleDot} />
        <FinanceKpiCard
          label="GRN closed"
          value={String(kpis.closed)}
          tone="success"
          icon={PackageCheck}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "pending", "partial", "closed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
              filter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {key === "all" ? "All" : `GRN ${key}`}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">PO #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">PO status</th>
                <th className="px-3 py-2 font-medium">GRN</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Loading purchase orders…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No purchase orders match this filter.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 transition-colors duration-150 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-medium tabular-nums">{row.document_number}</td>
                  <td className="px-3 py-2 tabular-nums">{row.document_date}</td>
                  <td className="px-3 py-2">{vendors[row.vendor_id] || row.vendor_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInr(row.total_amount)}</td>
                  <td className="px-3 py-2">
                    <FinanceStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={grnTone(row.grn_status)} className="uppercase">
                      {row.grn_status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.source_module === "crm" ? "CRM OVF" : row.source_module || "Manual"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/procurement/orders/${row.id}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "cursor-pointer transition-colors duration-200",
                      )}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
