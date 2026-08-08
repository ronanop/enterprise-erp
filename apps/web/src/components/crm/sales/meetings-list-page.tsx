"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
import {
  MeetingsDataTable,
  type MeetingSortKey,
} from "@/components/crm/sales/meetings-data-table";
import { MeetingFormDialog } from "@/components/crm/sales/meeting-form-dialog";
import {
  meetingRelatedToLabel,
  meetingTypeLabel,
} from "@/lib/crm/meetings-display";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  getCompany,
  listEmployeeOptions,
  listMeetings,
  type Company,
  type CrmMeeting,
  type Option,
} from "@/services/sales-crm-service";

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
  const { sortBy, sortDir, onSort } = useTableSort<MeetingSortKey>("when", "desc");

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

  const hostName = useCallback(
    (id: string) => employees.find((employee) => employee.id === id)?.label ?? id.slice(0, 8),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.meeting_code.toLowerCase().includes(q) ||
        (row.location ?? "").toLowerCase().includes(q) ||
        (row.participants_text ?? "").toLowerCase().includes(q) ||
        meetingTypeLabel(row.meeting_mode).toLowerCase().includes(q) ||
        meetingRelatedToLabel(row.related_to).toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        title: (r) => r.title,
        when: (r) => `${r.meeting_date} ${r.start_time ?? ""}`,
        meeting_type: (r) => meetingTypeLabel(r.meeting_mode),
        location: (r) => r.location ?? "",
        related_to: (r) => meetingRelatedToLabel(r.related_to),
        host: (r) => hostName(r.organizer_employee_id),
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir, hostName],
  );

  const actions = (
    <Button
      type="button"
      size="sm"
      className="cursor-pointer"
      onClick={() => setDialogOpen(true)}
    >
      <Plus className="size-3.5" /> New Meeting
    </Button>
  );

  return (
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Meetings"
          description="Schedule and track client meetings linked to company accounts."
          actions={actions}
        />
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Meetings"
          subtitle="Scheduled client meetings"
          icon={CalendarDays}
          count={sorted.length}
          actions={embedded ? actions : null}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search meetings…",
          }}
        />

        <MeetingsDataTable
          rows={sorted}
          hostName={hostName}
          loading={loading}
          sortable={{ sortBy, sortDir, onSort }}
          emptyMessage="No meetings yet. Create a meeting from here or from a company's Open Activities."
        />
      </CrmListPanel>

      <MeetingFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
        companyAccount={companyAccount}
        defaultBranchId={companyAccount?.branch_id}
      />
    </CrmPage>
  );
}
