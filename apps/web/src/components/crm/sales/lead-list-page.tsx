"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import {
  CrmSortableTh,
  sortRows,
  useTableSort,
  type SortValue,
} from "@/components/crm/sales/crm-table-sort";
import {
  leadColumnLabel,
  leadTableColumnDefs,
  LeadListColumnPicker,
  type LeadListColumnId,
  useLeadListVisibleColumns,
} from "@/components/crm/sales/lead-list-columns";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { PageHeader } from "@/components/layout/page-header";
import { SalesStageBadge } from "@/components/crm/sales/sales-stage-badge";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { ApiClientError } from "@/services/api-client";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { formatInr, fullName, listSalesLeads, type SalesLead } from "@/services/sales-crm-service";

type SortKey = LeadListColumnId;

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
  const { settings } = useCrmSettingsEffective();
  const [visibleColumns, setVisibleColumns, columnKeys] = useLeadListVisibleColumns();

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

  const orderedColumns = useMemo(() => {
    const defs = leadTableColumnDefs(settings).map((c) => c.key);
    const keys = defs.length ? defs : columnKeys;
    return keys.filter((id) => visibleColumns.has(id));
  }, [settings, columnKeys, visibleColumns]);

  const sorted = useMemo(() => {
    const accessors: Record<string, (r: SalesLead) => SortValue> = {
      lead: (r) => fullName(r),
      mobile: (r) => r.mobile,
      expected_amount: (r) => r.expected_amount,
      blueprint_state: (r) => r.blueprint_state,
      status: (r) => r.status,
    };
    for (const col of orderedColumns) {
      if (col.startsWith("cf_") && !accessors[col]) {
        accessors[col] = (r) =>
          String((r.custom_fields as Record<string, unknown> | undefined)?.[col] ?? "") as SortValue;
      }
    }
    return sortRows(filtered, sortBy, sortDir, accessors);
  }, [filtered, sortBy, sortDir, orderedColumns]);

  function renderCell(row: SalesLead, col: LeadListColumnId) {
    if (col.startsWith("cf_")) {
      const val = (row.custom_fields as Record<string, unknown> | undefined)?.[col];
      return val != null && String(val) !== "" ? String(val) : "-";
    }
    switch (col) {
      case "lead":
        return (
          <Link href={`/crm/leads/${row.id}`} className="cursor-pointer hover:underline">
            {fullName(row)} · {formatCrmCode(row.lead_code)}
          </Link>
        );
      case "mobile":
        return row.mobile;
      case "expected_amount":
        return row.expected_amount ? formatInr(row.expected_amount) : "-";
      case "blueprint_state":
        return (
          <SalesStageBadge
            label={resolveSalesStageLabel({
              entityType: "lead",
              blueprintState: row.blueprint_state,
              lead: row,
            })}
            state={row.blueprint_state}
            entityType="lead"
          />
        );
      case "status":
        return <FinanceStatusBadge status={row.status} />;
      default:
        return "-";
    }
  }

  return (
    <CrmPage>
      {!embedded ? <PageHeader title="Leads" /> : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Leads"
          icon={UserPlus}
          count={sorted.length}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search leads…",
          }}
          actions={
            <LeadListColumnPicker
              visible={visibleColumns}
              onChange={setVisibleColumns}
              columnKeys={columnKeys}
              settings={settings}
            />
          }
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                {orderedColumns.map((col) => (
                  <CrmSortableTh
                    key={col}
                    label={leadColumnLabel(settings, col)}
                    sortKey={col}
                    activeKey={sortBy}
                    dir={sortDir}
                    onSort={onSort}
                  />
                ))}
                <th className="px-4 py-2.5 font-medium tracking-wide uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={orderedColumns.length + 1}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading leads…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={orderedColumns.length + 1}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No active leads. Converted leads appear under Opportunities only.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    {orderedColumns.map((col) => (
                      <td
                        key={col}
                        className={
                          col === "lead"
                            ? "px-4 py-2.5 font-medium text-foreground"
                            : "px-4 py-2.5 text-muted-foreground"
                        }
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
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
