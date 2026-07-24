"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  listCompanies,
  listEmployeeOptions,
  type Company,
  type Option,
} from "@/services/sales-crm-service";

type SortKey =
  | "customer_name"
  | "account_number"
  | "owner"
  | "industry"
  | "source"
  | "customer_id_ext"
  | "status";

export function KycAccountMappingPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("customer_name");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companies, employeeOptions] = await Promise.all([
        listCompanies(),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setRows(
        companyAccountId
          ? companies.filter((company) => company.id === companyAccountId)
          : companies,
      );
      setEmployees(employeeOptions);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load KYC mapping");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeName = (id: string | null) =>
    id ? employees.find((employee) => employee.id === id)?.label ?? id.slice(0, 8) : "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.customer_name.toLowerCase().includes(q) ||
        row.account_number.toLowerCase().includes(q) ||
        (row.industry ?? "").toLowerCase().includes(q) ||
        (row.customer_id_ext ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        customer_name: (r) => r.customer_name,
        account_number: (r) => r.account_number,
        owner: (r) => employeeName(r.account_owner_id),
        industry: (r) => r.industry,
        source: (r) => r.source,
        customer_id_ext: (r) => r.customer_id_ext,
        status: (r) => r.status,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sortBy, sortDir, employees],
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="KYC - Account Mapping"
          description="Company account KYC profile — ownership, source, industry, and external customer IDs."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Account Mapping"
          subtitle="KYC account profiles"
          icon={ShieldCheck}
          count={sorted.length}
          actions={
            embedded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search account…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Customer" sortKey="customer_name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Account No." sortKey="account_number" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Owner" sortKey="owner" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Industry" sortKey="industry" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Source" sortKey="source" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Customer ID" sortKey="customer_id_ext" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No company accounts yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/crm/companies/${row.id}`}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {row.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.account_number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {employeeName(row.account_owner_id)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.industry || "—"}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {(row.source || "—").replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.customer_id_ext || "—"}
                    </td>
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
