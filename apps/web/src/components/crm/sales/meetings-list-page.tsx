"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";

import { MeetingFormDialog } from "@/components/crm/sales/meeting-form-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  getCompany,
  listEmployeeOptions,
  listMeetings,
  type Company,
  type CrmMeeting,
  type Option,
} from "@/services/sales-crm-service";

const VENUE_LABELS: Record<string, string> = {
  client_location: "Client location",
  office: "Office",
  online: "Online",
  phone: "Phone",
  in_person: "In person",
  video: "Video",
};

function formatMeetingWhen(row: CrmMeeting): string {
  const date = row.meeting_date;
  if (row.all_day) return `${date} · All day`;
  const start = row.start_time?.slice(0, 5) ?? "";
  const end = row.end_time?.slice(0, 5) ?? "";
  if (start && end) return `${date} · ${start} – ${end}`;
  if (start) return `${date} · ${start}`;
  return date;
}

export function MeetingsListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<CrmMeeting[]>([]);
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
      const [meetings, employeeOptions, company] = await Promise.all([
        listMeetings(companyAccountId),
        listEmployeeOptions().catch(() => [] as Option[]),
        companyAccountId
          ? getCompany(companyAccountId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setRows(meetings);
      setEmployees(employeeOptions);
      setCompanyAccount(company);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hostName = (id: string) =>
    employees.find((employee) => employee.id === id)?.label ?? id.slice(0, 8);

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.title.toLowerCase().includes(q) ||
      row.meeting_code.toLowerCase().includes(q) ||
      (row.location ?? "").toLowerCase().includes(q) ||
      (row.participants_text ?? "").toLowerCase().includes(q)
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
        <Plus className="size-3.5" /> New Meeting
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="Meetings"
          description="Schedule and track client meetings linked to company accounts."
          actions={actions}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-sm font-medium tracking-tight">Meetings</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
            {embedded ? actions : null}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meetings…"
              className="h-8 w-52 shrink-0 sm:w-56"
            />
          </div>
        </div>

        {error ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Meeting</th>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Venue</th>
                <th className="px-4 py-2.5">Host</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading meetings…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <CalendarDays className="size-5 text-muted-foreground" />
                      <p className="text-sm">No meetings yet</p>
                      <p className="text-xs">
                        Create a meeting from here or from a company&apos;s Open Activities.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{row.title}</div>
                      <div className="text-[11px] text-muted-foreground">{row.meeting_code}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatMeetingWhen(row)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {VENUE_LABELS[row.meeting_mode ?? ""] ?? row.meeting_mode ?? "—"}
                      {row.location ? (
                        <span className="block text-[11px]">{row.location}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {hostName(row.organizer_employee_id)}
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

      <MeetingFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
        companyAccount={companyAccount}
        defaultBranchId={companyAccount?.branch_id}
      />
    </div>
  );
}
