"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { PageHeader } from "@/components/layout/page-header";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import {
  COMPANY_LIST_COLUMN_LABELS,
  CompanyListColumnPicker,
  type CompanyListColumnId,
  useCompanyListVisibleColumns,
} from "@/components/crm/sales/company-list-columns";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { ApiClientError } from "@/services/api-client";
import {
  listCompanies,
  listCrmMemberOptions,
  type Company,
  type Option,
} from "@/services/sales-crm-service";

type SortKey = CompanyListColumnId;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function formatSource(source: string | null | undefined): string {
  if (!source) return "—";
  return source.replaceAll("_", " ");
}

export function CompanyListPage() {
  const [rows, setRows] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibleColumns, setVisibleColumns] = useCompanyListVisibleColumns();
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("customer_name");

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.label);
    return map;
  }, [employees]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companies, employeeOptions] = await Promise.all([
        listCompanies(),
        listCrmMemberOptions().catch(() => [] as Option[]),
      ]);
      setRows(companies);
      setEmployees(employeeOptions);
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

  const columnOrder = useMemo(
    () =>
      (
        [
          "customer_name",
          "phone",
          "customer_email",
          "account_owner",
          "created_at",
          "updated_at",
          "source",
        ] as const
      ).filter((id) => visibleColumns.has(id)),
    [visibleColumns],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const owner = r.account_owner_id ? ownerLabelById.get(r.account_owner_id) ?? "" : "";
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q) ||
        formatSource(r.source).toLowerCase().includes(q)
      );
    });
  }, [rows, query, ownerLabelById]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        customer_name: (r) => r.customer_name,
        phone: (r) => r.phone,
        customer_email: (r) => r.customer_email,
        account_owner: (r) =>
          r.account_owner_id ? ownerLabelById.get(r.account_owner_id) ?? "" : "",
        created_at: (r) => r.created_at,
        updated_at: (r) => r.updated_at,
        source: (r) => r.source,
      }),
    [filtered, sortBy, sortDir, ownerLabelById],
  );

  function renderCell(row: Company, col: CompanyListColumnId) {
    switch (col) {
      case "customer_name":
        return (
          <Link href={`/crm/companies/${row.id}`} className="cursor-pointer font-medium hover:underline">
            {row.customer_name}
          </Link>
        );
      case "phone":
        return row.phone ?? "—";
      case "customer_email":
        return row.customer_email ?? "—";
      case "account_owner":
        return row.account_owner_id
          ? ownerLabelById.get(row.account_owner_id) ?? "—"
          : "—";
      case "created_at":
        return formatDateTime(row.created_at);
      case "updated_at":
        return formatDateTime(row.updated_at);
      case "source":
        return formatSource(row.source);
      default:
        return "—";
    }
  }

  const colSpan = Math.max(columnOrder.length, 1);

  return (
    <CrmPage>
      <PageHeader
        title="Company"
        description="Sales accounts — the only entry point for creating leads. Convert a company's lead through Opportunity, Quote, and OVF to Won."
        actions={
          <Link
            href="/crm/companies/new"
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
          >
            <Plus className="size-3.5" />
            Create Company
          </Link>
        }
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Accounts"
          icon={Building2}
          count={sorted.length}
          actions={
            <CompanyListColumnPicker visible={visibleColumns} onChange={setVisibleColumns} />
          }
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search companies…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                {columnOrder.map((col) => (
                  <CrmSortableTh
                    key={col}
                    label={COMPANY_LIST_COLUMN_LABELS[col]}
                    sortKey={col}
                    activeKey={sortBy}
                    dir={sortDir}
                    onSort={onSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    Loading companies…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    No companies yet. Create one to start the sales blueprint.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30"
                  >
                    {columnOrder.map((col) => (
                      <td
                        key={col}
                        className={`px-4 py-2.5 text-muted-foreground ${col === "customer_name" ? "text-foreground" : ""}`}
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
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
