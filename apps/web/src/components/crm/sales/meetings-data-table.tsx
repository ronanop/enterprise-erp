"use client";

import { CalendarDays } from "lucide-react";

import { CRM_TABLE_HEAD_CELL, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { CrmSortableTh, type SortDir } from "@/components/crm/sales/crm-table-sort";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import {
  formatMeetingWhen,
  meetingRelatedToLabel,
  meetingTypeLabel,
} from "@/lib/crm/meetings-display";
import type { CrmMeeting } from "@/services/sales-crm-service";

export type MeetingSortKey =
  | "title"
  | "when"
  | "meeting_type"
  | "location"
  | "related_to"
  | "host"
  | "status";

type MeetingsDataTableProps = {
  rows: CrmMeeting[];
  hostName: (employeeId: string) => string;
  emptyMessage?: string;
  loading?: boolean;
  sortable?: {
    sortBy: MeetingSortKey;
    sortDir: SortDir;
    onSort: (key: MeetingSortKey) => void;
  };
};

const COL_COUNT = 7;

export function MeetingsDataTable({
  rows,
  hostName,
  emptyMessage = "No meetings yet",
  loading = false,
  sortable,
}: MeetingsDataTableProps) {
  return (
    <div className="erp-scroll overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead>
          <tr className={CRM_TABLE_HEAD_ROW}>
            {sortable ? (
              <>
                <CrmSortableTh
                  label="Meeting"
                  sortKey="title"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="When"
                  sortKey="when"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="Meeting Type"
                  sortKey="meeting_type"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="Location"
                  sortKey="location"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="Related To"
                  sortKey="related_to"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="Host"
                  sortKey="host"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
                <CrmSortableTh
                  label="Status"
                  sortKey="status"
                  activeKey={sortable.sortBy}
                  dir={sortable.sortDir}
                  onSort={sortable.onSort}
                />
              </>
            ) : (
              <>
                <th className={CRM_TABLE_HEAD_CELL}>Meeting</th>
                <th className={CRM_TABLE_HEAD_CELL}>When</th>
                <th className={CRM_TABLE_HEAD_CELL}>Meeting Type</th>
                <th className={CRM_TABLE_HEAD_CELL}>Location</th>
                <th className={CRM_TABLE_HEAD_CELL}>Related To</th>
                <th className={CRM_TABLE_HEAD_CELL}>Host</th>
                <th className={CRM_TABLE_HEAD_CELL}>Status</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-muted-foreground">
                Loading meetings…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={COL_COUNT} className="px-4 py-12 text-center text-muted-foreground">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                  <CalendarDays className="size-5 text-muted-foreground" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 last:border-0 hover:bg-accent/30"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{row.title}</div>
                  <div className="text-[11px] text-muted-foreground">{row.meeting_code}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {formatMeetingWhen(row)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {meetingTypeLabel(row.meeting_mode)}
                </td>
                <td className="max-w-[200px] px-4 py-2.5 text-muted-foreground">
                  <span className="line-clamp-2">{row.location?.trim() || "—"}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {meetingRelatedToLabel(row.related_to)}
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
  );
}
