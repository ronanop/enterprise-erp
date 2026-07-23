"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Target } from "lucide-react";

import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import { FollowupFormDialog } from "@/components/crm/sales/followup-form-dialog";
import { MeetingFormDialog } from "@/components/crm/sales/meeting-form-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  fullName,
  getCompany,
  listEmployeeOptions,
  listFollowups,
  listMeetings,
  listSalesLeads,
  type Company,
  type CrmFollowup,
  type CrmMeeting,
  type Option,
  type SalesLead,
} from "@/services/sales-crm-service";

function textOrDash(value: string | null | undefined): string {
  return value?.trim() || "-";
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-foreground">{children}</dd>
    </div>
  );
}

const VENUE_LABELS: Record<string, string> = {
  client_location: "Client location",
  office: "Office",
  online: "Online",
  phone: "Phone",
};

function formatMeetingWhen(row: CrmMeeting): string {
  if (row.all_day) return `${row.meeting_date} · All day`;
  const start = row.start_time?.slice(0, 5) ?? "";
  const end = row.end_time?.slice(0, 5) ?? "";
  if (start && end) return `${row.meeting_date} · ${start} – ${end}`;
  if (start) return `${row.meeting_date} · ${start}`;
  return row.meeting_date;
}

function formatFollowupDate(row: CrmFollowup): string {
  const iso = row.followup_at;
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatFollowupTime(row: CrmFollowup): string {
  const iso = row.followup_at;
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.length >= 16 ? iso.slice(11, 16) : "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CompanyDetailPage({ companyAccountId }: { companyAccountId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [meetings, setMeetings] = useState<CrmMeeting[]>([]);
  const [followups, setFollowups] = useState<CrmFollowup[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRow, allLeads, employeeOptions, meetingRows, followupRows] = await Promise.all([
        getCompany(companyAccountId),
        listSalesLeads(companyAccountId).catch(() => [] as SalesLead[]),
        listEmployeeOptions().catch(() => [] as Option[]),
        listMeetings(companyAccountId).catch(() => [] as CrmMeeting[]),
        listFollowups(companyAccountId).catch(() => [] as CrmFollowup[]),
      ]);
      setCompany(companyRow);
      setLeads(allLeads);
      setEmployees(employeeOptions);
      setMeetings(meetingRows);
      setFollowups(followupRows);
    } catch (err) {
      setCompany(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const employeeName = (id: string | null) =>
    id ? employees.find((employee) => employee.id === id)?.label ?? id : "-";
  const openMeetings = meetings.filter((m) => m.status === "scheduled");
  const openFollowups = followups.filter((f) => f.status === "scheduled");

  return (
    <CompanyWorkspaceShell companyAccountId={companyAccountId}>
      {loading && !company ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      ) : error || !company ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? "Company not found"}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium tracking-tight">Account Information</h2>
            <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
              <DetailItem label="Customer Name">{textOrDash(company.customer_name)}</DetailItem>
              <DetailItem label="Account Number">{textOrDash(company.account_number)}</DetailItem>
              <DetailItem label="Status">
                {company.status ? <FinanceStatusBadge status={company.status} /> : "-"}
              </DetailItem>
              <DetailItem label="Account Owner">{employeeName(company.account_owner_id)}</DetailItem>
              <DetailItem label="Account Type">
                <span className="capitalize">{textOrDash(company.account_type)}</span>
              </DetailItem>
              <DetailItem label="Industry">{textOrDash(company.industry)}</DetailItem>
              <DetailItem label="Other Industries">{textOrDash(company.other_industries)}</DetailItem>
              <DetailItem label="Portal ID">{textOrDash(company.portal_id)}</DetailItem>
              <DetailItem label="Source">
                <span className="capitalize">{textOrDash(company.source)?.replaceAll("_", " ")}</span>
              </DetailItem>
              <DetailItem label="Rating">
                <span className="capitalize">{textOrDash(company.rating)}</span>
              </DetailItem>
              <DetailItem label="First Name">{textOrDash(company.first_name)}</DetailItem>
              <DetailItem label="Last Name">{textOrDash(company.last_name)}</DetailItem>
              <DetailItem label="Customer Email">{textOrDash(company.customer_email)}</DetailItem>
              <DetailItem label="Phone">{textOrDash(company.phone)}</DetailItem>
              <DetailItem label="Website">{textOrDash(company.website)}</DetailItem>
              <DetailItem label="Account Ownership">{employeeName(company.account_ownership_id)}</DetailItem>
              <DetailItem label="Customer ID">{textOrDash(company.customer_id_ext)}</DetailItem>
              <DetailItem label="Role">{textOrDash(company.role)}</DetailItem>
            </dl>

            <h3 className="border-t border-border/70 pt-3 text-sm font-medium tracking-tight">
              Address Information
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
              <DetailItem label="Billing Street">{textOrDash(company.billing_street)}</DetailItem>
              <DetailItem label="Billing City">{textOrDash(company.billing_city)}</DetailItem>
              <DetailItem label="Billing State">{textOrDash(company.billing_state)}</DetailItem>
              <DetailItem label="Billing Code">{textOrDash(company.billing_code)}</DetailItem>
              <DetailItem label="Billing Country">{textOrDash(company.billing_country)}</DetailItem>
              <DetailItem label="Shipping Street">{textOrDash(company.shipping_street)}</DetailItem>
              <DetailItem label="Shipping City">{textOrDash(company.shipping_city)}</DetailItem>
              <DetailItem label="Shipping State">{textOrDash(company.shipping_state)}</DetailItem>
              <DetailItem label="Shipping Code">{textOrDash(company.shipping_code)}</DetailItem>
              <DetailItem label="Shipping Country">{textOrDash(company.shipping_country)}</DetailItem>
            </dl>

            <h3 className="border-t border-border/70 pt-3 text-sm font-medium tracking-tight">
              Description Information
            </h3>
            <dl className="text-xs">
              <DetailItem label="Description">
                <span className="whitespace-pre-wrap">{textOrDash(company.description)}</span>
              </DetailItem>
            </dl>
          </section>

          <section
            id="company-meetings"
            className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
                <CalendarDays className="size-3.5" /> Meetings
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{openMeetings.length}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setMeetingOpen(true)}
                >
                  <Plus className="size-3.5" /> Meeting
                </Button>
                <Link
                  href={`/crm/companies/${company.id}/meetings`}
                  className="text-xs font-medium text-primary underline-offset-2 transition-opacity duration-200 hover:underline hover:opacity-80"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5">Venue</th>
                    <th className="px-4 py-2.5">Host</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No meetings yet — use “Meeting” above to schedule one.
                      </td>
                    </tr>
                  ) : (
                    meetings.slice(0, 5).map((meeting) => (
                      <tr
                        key={meeting.id}
                        className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {meeting.title}
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {meeting.meeting_code}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatMeetingWhen(meeting)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {VENUE_LABELS[meeting.meeting_mode ?? ""] ?? meeting.meeting_mode ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {employeeName(meeting.organizer_employee_id)}
                        </td>
                        <td className="px-4 py-2.5">
                          <FinanceStatusBadge status={meeting.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="company-followups"
            className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
                <ClipboardList className="size-3.5" /> Follow Up
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{openFollowups.length}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setFollowupOpen(true)}
                >
                  <Plus className="size-3.5" /> Follow Up
                </Button>
                <Link
                  href={`/crm/companies/${company.id}/customer-followups`}
                  className="text-xs font-medium text-primary underline-offset-2 transition-opacity duration-200 hover:underline hover:opacity-80"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Customer Name</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Remark</th>
                    <th className="px-4 py-2.5">Team Member</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No follow-ups yet — use “Follow Up” above to schedule one.
                      </td>
                    </tr>
                  ) : (
                    followups.slice(0, 5).map((followup) => (
                      <tr
                        key={followup.id}
                        className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {followup.customer_name || company.customer_name}
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {followup.followup_code}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatFollowupDate(followup)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatFollowupTime(followup)}
                        </td>
                        <td className="max-w-[240px] px-4 py-2.5 text-muted-foreground">
                          <span className="line-clamp-2">{textOrDash(followup.notes)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="font-normal">
                            {employeeName(followup.owner_employee_id)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="company-leads"
            className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
                <Target className="size-3.5" /> Leads from this company
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{leads.length}</Badge>
                <Link
                  href={`/crm/companies/${company.id}/leads`}
                  className="text-xs font-medium text-primary underline-offset-2 transition-opacity duration-200 hover:underline hover:opacity-80"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Lead</th>
                    <th className="px-4 py-2.5">Mobile</th>
                    <th className="px-4 py-2.5">Blueprint State</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No leads yet — use “Create Lead” above to start the sales process.
                      </td>
                    </tr>
                  ) : (
                    leads.slice(0, 5).map((lead) => (
                      <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          <Link href={`/crm/leads/${lead.id}`} className="cursor-pointer hover:underline">
                            {fullName(lead)} · {lead.lead_code}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{lead.mobile}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="capitalize">
                            {lead.blueprint_state.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <FinanceStatusBadge status={lead.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <MeetingFormDialog
            open={meetingOpen}
            companyAccount={company}
            onClose={() => setMeetingOpen(false)}
            onSaved={() => void load()}
          />
          <FollowupFormDialog
            open={followupOpen}
            companyAccount={company}
            onClose={() => setFollowupOpen(false)}
            onSaved={() => void load()}
          />
        </div>
      )}
    </CompanyWorkspaceShell>
  );
}
