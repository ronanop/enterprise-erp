"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { formatInr, listQuotes, type Quote } from "@/services/sales-crm-service";

export function QuoteListPage() {
  const [rows, setRows] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listQuotes());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => r.quote_no.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Customer quotations with GST/HSN lines and a margin-gated approval workflow."
        actions={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Quotes are created from an eligible Opportunity (after the OEM quote is attached) — open the
        opportunity to create one.
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium tracking-tight">Quotes</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quote no…" className="h-8 max-w-xs" />
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Quote No.</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5">Approval</th>
                <th className="px-4 py-2.5">Grand Total</th>
                <th className="px-4 py-2.5">Avg Margin</th>
                <th className="px-4 py-2.5">Valid Until</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading quotes…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No quotes yet.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/quotes/${row.id}`} className="cursor-pointer hover:underline">
                        {row.quote_no}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.quote_stage.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.approval_status} />
                    </td>
                    <td className="px-4 py-2.5">{formatInr(row.grand_total)}</td>
                    <td className="px-4 py-2.5">{row.avg_margin_pct}%</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.valid_until ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
