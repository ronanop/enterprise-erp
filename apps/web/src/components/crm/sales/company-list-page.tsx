"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { listCompanies, type Company } from "@/services/sales-crm-service";

type SortKey =
  | "customer_name"
  | "account_number"
  | "phone"
  | "customer_email"
  | "industry"
  | "created_at"
  | "status";

function formatCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function CompanyListPage() {
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("customer_name");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCompanies());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        r.account_number.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        customer_name: (r) => r.customer_name,
        account_number: (r) => r.account_number,
        phone: (r) => r.phone,
        customer_email: (r) => r.customer_email,
        industry: (r) => r.industry,
        created_at: (r) => r.created_at,
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir],
  );

  return (
    <CrmPage>
      <PageHeader
        title="Company"
        description="Sales accounts — the only entry point for creating leads. Convert a company's lead through Opportunity, Quote, and OVF to Won."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Link
              href="/crm/companies/new"
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Plus className="size-3.5" />
              New Company
            </Link>
          </div>
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Accounts"
          subtitle="Sales accounts"
          icon={Building2}
          count={sorted.length}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search companies…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Customer Name" sortKey="customer_name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Account No." sortKey="account_number" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Phone" sortKey="phone" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Email" sortKey="customer_email" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Industry" sortKey="industry" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Date Created" sortKey="created_at" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading companies…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No companies yet. Create one to start the sales blueprint.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link href={`/crm/companies/${row.id}`} className="cursor-pointer hover:underline">
                        {row.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.account_number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.phone ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.customer_email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.industry}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatCreatedDate(row.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                      {row.locked ? (
                        <Badge variant="destructive" className="ml-1">
                          Locked
                        </Badge>
                      ) : null}
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
