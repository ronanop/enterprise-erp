"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmInfoBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { formatInr, listQuotes, type Quote } from "@/services/sales-crm-service";

type SortKey =
  | "quote_no"
  | "quote_stage"
  | "created_at"
  | "grand_total"
  | "avg_margin_pct"
  | "valid_until";

function formatCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function QuoteListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("quote_no");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuotes(
        companyAccountId ? { company_account_id: companyAccountId } : undefined,
      );
      setRows(
        companyAccountId
          ? data.filter((row) => row.company_account_id === companyAccountId)
          : data,
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.quote_no.toLowerCase().includes(q));
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        quote_no: (r) => r.quote_no,
        quote_stage: (r) => r.quote_stage,
        created_at: (r) => r.created_at,
        grand_total: (r) => r.grand_total,
        avg_margin_pct: (r) => r.avg_margin_pct,
        valid_until: (r) => r.valid_until,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
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
      ) : null}

      {!embedded ? (
        <CrmInfoBanner>
          Quotes are created from an eligible Opportunity (after the OEM quote is attached) — open the
          opportunity to create one.
        </CrmInfoBanner>
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Quotes"
          subtitle="Customer quotations"
          icon={FileText}
          count={sorted.length}
          actions={
            embedded ? (
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search quote no…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Quote No." sortKey="quote_no" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Stage" sortKey="quote_stage" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Date Created" sortKey="created_at" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Grand Total" sortKey="grand_total" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Avg Margin" sortKey="avg_margin_pct" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Valid Until" sortKey="valid_until" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading quotes…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No quotes yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
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
                    <td className="px-4 py-2.5 text-muted-foreground">{formatCreatedDate(row.created_at)}</td>
                    <td className="px-4 py-2.5">{formatInr(row.grand_total)}</td>
                    <td className="px-4 py-2.5">{row.avg_margin_pct}%</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.valid_until ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>
    </CrmPage>
  );
}
