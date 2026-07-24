"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  MapPin,
  Plus,
  Target,
} from "lucide-react";

import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import {
  CrmCountBadge,
  CrmDetailGrid,
  CrmDetailItem,
  CrmErrorBanner,
  CrmIconBadge,
  CrmListPanel,
  CrmPage,
  CrmSection,
  CrmViewAllLink,
} from "@/components/crm/crm-ui";
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
        <CrmErrorBanner>{error ?? "Company not found"}</CrmErrorBanner>
      ) : (
        <CrmPage>
          <CrmSection
            title="Account Information"
            subtitle="Core account, contact, and ownership fields"
            icon={Building2}
          >
            <CrmDetailGrid>
              <CrmDetailItem label="Customer Name">{textOrDash(company.customer_name)}</CrmDetailItem>
              <CrmDetailItem label="Account Number">{textOrDash(company.account_number)}</CrmDetailItem>
              <CrmDetailItem label="Status">
                {company.status ? <FinanceStatusBadge status={company.status} /> : "-"}
              </CrmDetailItem>
              <CrmDetailItem label="Account Owner">{employeeName(company.account_owner_id)}</CrmDetailItem>
              <CrmDetailItem label="Account Type">
                <span className="capitalize">{textOrDash(company.account_type)}</span>
              </CrmDetailItem>
              <CrmDetailItem label="Industry">{textOrDash(company.industry)}</CrmDetailItem>
              <CrmDetailItem label="Other Industries">{textOrDash(company.other_industries)}</CrmDetailItem>
              <CrmDetailItem label="Portal ID">{textOrDash(company.portal_id)}</CrmDetailItem>
              <CrmDetailItem label="Source">
                <span className="capitalize">{textOrDash(company.source)?.replaceAll("_", " ")}</span>
              </CrmDetailItem>
              <CrmDetailItem label="Rating">
                <span className="capitalize">{textOrDash(company.rating)}</span>
              </CrmDetailItem>
              <CrmDetailItem label="First Name">{textOrDash(company.first_name)}</CrmDetailItem>
              <CrmDetailItem label="Last Name">{textOrDash(company.last_name)}</CrmDetailItem>
              <CrmDetailItem label="Customer Email">{textOrDash(company.customer_email)}</CrmDetailItem>
              <CrmDetailItem label="Phone">{textOrDash(company.phone)}</CrmDetailItem>
              <CrmDetailItem label="Website">{textOrDash(company.website)}</CrmDetailItem>
              <CrmDetailItem label="Account Ownership">{employeeName(company.account_ownership_id)}</CrmDetailItem>
              <CrmDetailItem label="Customer ID">{textOrDash(company.customer_id_ext)}</CrmDetailItem>
              <CrmDetailItem label="Role">{textOrDash(company.role)}</CrmDetailItem>
            </CrmDetailGrid>

            <div className="mt-4 border-t border-border/70 pt-3">
              <div className="mb-3 flex items-center gap-2">
                <CrmIconBadge icon={MapPin} className="size-7" />
                <h3 className="text-sm font-medium tracking-tight">Address Information</h3>
              </div>
              <CrmDetailGrid>
                <CrmDetailItem label="Billing Street">{textOrDash(company.billing_street)}</CrmDetailItem>
                <CrmDetailItem label="Billing City">{textOrDash(company.billing_city)}</CrmDetailItem>
                <CrmDetailItem label="Billing State">{textOrDash(company.billing_state)}</CrmDetailItem>
                <CrmDetailItem label="Billing Code">{textOrDash(company.billing_code)}</CrmDetailItem>
                <CrmDetailItem label="Billing Country">{textOrDash(company.billing_country)}</CrmDetailItem>
                <CrmDetailItem label="Shipping Street">{textOrDash(company.shipping_street)}</CrmDetailItem>
                <CrmDetailItem label="Shipping City">{textOrDash(company.shipping_city)}</CrmDetailItem>
                <CrmDetailItem label="Shipping State">{textOrDash(company.shipping_state)}</CrmDetailItem>
                <CrmDetailItem label="Shipping Code">{textOrDash(company.shipping_code)}</CrmDetailItem>
                <CrmDetailItem label="Shipping Country">{textOrDash(company.shipping_country)}</CrmDetailItem>
              </CrmDetailGrid>
            </div>

            <div className="mt-4 border-t border-border/70 pt-3">
              <h3 className="mb-3 text-sm font-medium tracking-tight">Description Information</h3>
              <CrmDetailGrid className="grid-cols-1 lg:grid-cols-1">
                <CrmDetailItem label="Description">
                  <span className="whitespace-pre-wrap">{textOrDash(company.description)}</span>
                </CrmDetailItem>
              </CrmDetailGrid>
            </div>
          </CrmSection>

          <div id="company-meetings">
          <CrmListPanel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CrmIconBadge icon={CalendarDays} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium tracking-tight">Meetings</h2>
                    <CrmCountBadge count={openMeetings.length} label="open" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Scheduled account meetings</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setMeetingOpen(true)}
                >
                  <Plus className="size-3.5" /> Meeting
                </Button>
                <CrmViewAllLink href={`/crm/companies/${company.id}/meetings`} />
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
          </CrmListPanel>
          </div>

          <div id="company-followups">
          <CrmListPanel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CrmIconBadge icon={ClipboardList} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium tracking-tight">Follow Up</h2>
                    <CrmCountBadge count={openFollowups.length} label="open" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Open customer follow-ups</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setFollowupOpen(true)}
                >
                  <Plus className="size-3.5" /> Follow Up
                </Button>
                <CrmViewAllLink href={`/crm/companies/${company.id}/customer-followups`} />
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
          </CrmListPanel>
          </div>

          <div id="company-leads">
          <CrmListPanel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CrmIconBadge icon={Target} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium tracking-tight">Leads from this company</h2>
                    <CrmCountBadge count={leads.length} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Sales blueprint entry points</p>
                </div>
              </div>
              <CrmViewAllLink href={`/crm/companies/${company.id}/leads`} />
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
          </CrmListPanel>
          </div>

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
        </CrmPage>
      )}
    </CompanyWorkspaceShell>
  );
}
