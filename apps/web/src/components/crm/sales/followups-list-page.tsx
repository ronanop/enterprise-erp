"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { FollowupFormDialog } from "@/components/crm/sales/followup-form-dialog";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  getCompany,
  listEmployeeOptions,
  listFollowups,
  type Company,
  type CrmFollowup,
  type Option,
} from "@/services/sales-crm-service";

type SortKey = "customer_name" | "date" | "time" | "remark" | "team_member" | "status";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.length >= 16 ? iso.slice(11, 16) : "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function FollowupsListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<CrmFollowup[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [companyAccount, setCompanyAccount] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("date", "desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [followups, employeeOptions, company] = await Promise.all([
        listFollowups(companyAccountId),
        listEmployeeOptions().catch(() => [] as Option[]),
        companyAccountId
          ? getCompany(companyAccountId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setRows(followups);
      setEmployees(employeeOptions);
      setCompanyAccount(company);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeName = (id: string) =>
    employees.find((employee) => employee.id === id)?.label ?? id.slice(0, 8);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        (row.customer_name ?? "").toLowerCase().includes(q) ||
        row.followup_code.toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        customer_name: (r) => r.customer_name,
        date: (r) => r.followup_at,
        time: (r) => formatTime(r.followup_at),
        remark: (r) => r.notes,
        team_member: (r) => employeeName(r.owner_employee_id),
        status: (r) => r.status,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sortBy, sortDir, employees],
  );

  const actions = (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() => void load()}
      >
        <RefreshCw className="size-3.5" /> Refresh
      </Button>
      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="size-3.5" /> Follow Up
      </Button>
    </div>
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Customer Follow Ups"
          description="Scheduled customer follow-ups with date, time, remark, and internal owner."
          actions={actions}
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Follow Ups"
          subtitle="Customer follow-ups"
          icon={ClipboardList}
          count={sorted.length}
          actions={embedded ? actions : null}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search customer or remark…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Customer Name" sortKey="customer_name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Date" sortKey="date" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Time" sortKey="time" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Remark" sortKey="remark" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Team Member" sortKey="team_member" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No follow-ups yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium">
                      {row.customer_name || "—"}
                      <div className="text-[11px] font-normal text-muted-foreground">
                        {row.followup_code}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(row.followup_at)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatTime(row.followup_at)}</td>
                    <td className="max-w-[240px] px-4 py-2.5 text-muted-foreground">
                      <span className="line-clamp-2">{row.notes || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="font-normal">
                        {employeeName(row.owner_employee_id)}
                      </Badge>
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

      <FollowupFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
        companyAccount={companyAccount}
        defaultBranchId={companyAccount?.branch_id}
      />
    </CrmPage>
  );
}
