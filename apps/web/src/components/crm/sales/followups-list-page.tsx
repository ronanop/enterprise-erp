"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { FollowupFormDialog } from "@/components/crm/sales/followup-form-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  getCompany,
  listEmployeeOptions,
  listFollowups,
  type Company,
  type CrmFollowup,
  type Option,
} from "@/services/sales-crm-service";

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

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.customer_name ?? "").toLowerCase().includes(q) ||
      row.followup_code.toLowerCase().includes(q) ||
      (row.notes ?? "").toLowerCase().includes(q)
    );
  });

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
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="Customer Follow Ups"
          description="Scheduled customer follow-ups with date, time, remark, and internal owner."
          actions={actions}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-sm font-medium tracking-tight">Follow Ups</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
            {embedded ? actions : null}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or remark…"
              className="h-8 w-52 shrink-0 sm:w-56"
            />
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Remark</th>
                <th className="px-4 py-2.5">Team Member</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No follow-ups yet.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
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
      </div>

      <FollowupFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
        companyAccount={companyAccount}
        defaultBranchId={companyAccount?.branch_id}
      />
    </div>
  );
}
