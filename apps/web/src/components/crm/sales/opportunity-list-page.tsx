"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmInfoBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setCrmSidebarFocus } from "@/lib/crm-sidebar-focus";
import { ApiClientError } from "@/services/api-client";
import { formatInr, listOpportunities, type Opportunity } from "@/services/sales-crm-service";

type SortKey = "opportunity_name" | "current_stage" | "expected_revenue" | "created_at" | "status";

function formatCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function OpportunityListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("opportunity_name");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOpportunities(
        companyAccountId ? { company_account_id: companyAccountId } : undefined,
      );
      setRows(
        companyAccountId
          ? data.filter((row) => row.company_account_id === companyAccountId)
          : data,
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!embedded) setCrmSidebarFocus("opportunities");
  }, [embedded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.opportunity_name.toLowerCase().includes(q) ||
        r.opportunity_code.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        opportunity_name: (r) => r.opportunity_name,
        current_stage: (r) => r.current_stage,
        expected_revenue: (r) => r.expected_revenue,
        created_at: (r) => r.created_at,
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Opportunities"
          description="Deals converted from a Lead — BOQ to Won/Lost sales blueprint."
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
          Opportunities are created only by converting a Lead — there is no direct “create” action here.
        </CrmInfoBanner>
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Opportunities"
          subtitle="Open and closed deals"
          icon={Handshake}
          count={sorted.length}
          actions={
            embedded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search opportunities…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Opportunity" sortKey="opportunity_name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Stage" sortKey="current_stage" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Expected Revenue" sortKey="expected_revenue" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Date Created" sortKey="created_at" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading opportunities…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No opportunities yet. Convert a Lead to create one.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/opportunities/${row.id}`} className="cursor-pointer hover:underline">
                        {row.opportunity_name} · {row.opportunity_code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.current_stage.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatInr(row.expected_revenue)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatCreatedDate(row.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
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
