"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, UserPlus } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { formatInr, fullName, listSalesLeads, type SalesLead } from "@/services/sales-crm-service";

type SortKey = "lead" | "mobile" | "expected_amount" | "blueprint_state" | "status";

export function LeadListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("lead");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSalesLeads(companyAccountId));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load leads");
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
    return rows.filter(
      (r) =>
        fullName(r).toLowerCase().includes(q) ||
        r.lead_code.toLowerCase().includes(q) ||
        r.mobile.includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        lead: (r) => fullName(r),
        mobile: (r) => r.mobile,
        expected_amount: (r) => r.expected_amount,
        blueprint_state: (r) => r.blueprint_state,
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Leads"
          description="Active sales-blueprint leads. After conversion, the deal continues under Opportunities only."
          actions={
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Leads"
          subtitle="Active sales leads"
          icon={UserPlus}
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
            placeholder: "Search leads…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Lead" sortKey="lead" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Mobile" sortKey="mobile" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Expected Amount" sortKey="expected_amount" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Blueprint State" sortKey="blueprint_state" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <th className="px-4 py-2.5 font-medium tracking-wide uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading leads…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No active leads. Converted leads appear under Opportunities only.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/leads/${row.id}`} className="cursor-pointer hover:underline">
                        {fullName(row)} · {row.lead_code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.mobile}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.expected_amount ? formatInr(row.expected_amount) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.blueprint_state.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/crm/leads/${row.id}`}
                        className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted/50"
                      >
                        Open
                      </Link>
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
