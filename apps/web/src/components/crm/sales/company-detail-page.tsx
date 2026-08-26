"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  MapPin,
  Plus,
  Target,
} from "lucide-react";

import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import {
  CrmCountBadge,
  CrmErrorBanner,
  CrmIconBadge,
  CrmListPanel,
  CrmPage,
  CrmSection,
  CrmViewAllLink,
  CRM_TABLE_HEAD_CELL,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { FollowupFormDialog } from "@/components/crm/sales/followup-form-dialog";
import { MeetingFormDialog } from "@/components/crm/sales/meeting-form-dialog";
import { MeetingsDataTable } from "@/components/crm/sales/meetings-data-table";
import {
  buildCompanyDocumentPreviewRows,
  enrichCompanyOvfsWithTotals,
  CompanyOverviewDealPanels,
  type CompanyOvfOverviewRow,
  type DocPreviewRow,
} from "@/components/crm/sales/company-overview-deal-panels";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  fullName,
  getCompany,
  listAttachmentsByCategory,
  listContacts,
  listCrmMemberOptions,
  listFollowups,
  listMeetings,
  listOpportunities,
  listOvfs,
  listQuotes,
  listSalesLeads,
  type Company,
  type Contact,
  type CrmFollowup,
  type CrmMeeting,
  type Opportunity,
  type Option,
  type Ovf,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

const COMPANY_SOURCES = [
  "referral",
  "website",
  "cold_call",
  "partner",
  "event",
  "advertisement",
  "other",
] as const;

function textOrDash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="flex min-h-8 w-full items-center rounded-lg border border-input bg-muted/20 px-2.5 text-sm text-foreground">
      {value}
    </div>
  );
}

function CompanyReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FinanceField label={label}>
      <ReadOnlyValue value={value} />
    </FinanceField>
  );
}

function formatSourceLabel(source: string): string {
  if (!source.trim()) return "—";
  if ((COMPANY_SOURCES as readonly string[]).includes(source)) {
    return source === "other" ? "other" : source.replaceAll("_", " ");
  }
  return source;
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

function formatFollowupTaskDeadline(row: CrmFollowup): string {
  const date = formatFollowupDate(row);
  const time = formatFollowupTime(row);
  if (date === "—") return "—";
  return time === "—" ? date : `${date} ${time}`;
}

function CompanyProfileReadOnly({
  company,
  employeeName,
}: {
  company: Company;
  employeeName: (id: string | null) => string;
}) {
  const knownSource = (COMPANY_SOURCES as readonly string[]).includes(company.source);
  const sourceSelectValue = knownSource ? company.source : "other";
  const otherSourceValue = knownSource ? "" : company.source;

  return (
    <>
      <CrmSection title="Account Information" icon={Building2}>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <div className="space-y-3">
            <CompanyReadOnlyField label="Account Manager Owner" value={employeeName(company.account_owner_id)} />
            <CompanyReadOnlyField label="Company Name *" value={textOrDash(company.customer_name)} />
            <CompanyReadOnlyField label="Company ID" value={textOrDash(company.account_number)} />
            <CompanyReadOnlyField label="Account Type *" value={textOrDash(company.account_type)} />
            <CompanyReadOnlyField label="Industry *" value={textOrDash(company.industry)} />
            <CompanyReadOnlyField label="Other Industries" value={textOrDash(company.other_industries)} />
            <CompanyReadOnlyField label="Source *" value={formatSourceLabel(sourceSelectValue)} />
            {sourceSelectValue === "other" ? (
              <CompanyReadOnlyField label="Other Source *" value={textOrDash(otherSourceValue)} />
            ) : null}
          </div>

          <div className="space-y-3">
            <CompanyReadOnlyField label="First Name *" value={textOrDash(company.first_name)} />
            <CompanyReadOnlyField label="Last Name *" value={textOrDash(company.last_name)} />
            <CompanyReadOnlyField label="Customer Email *" value={textOrDash(company.customer_email)} />
            <CompanyReadOnlyField label="Phone *" value={textOrDash(company.phone)} />
            <CompanyReadOnlyField label="Website" value={textOrDash(company.website)} />
            <CompanyReadOnlyField
              label="Assigned Ownership"
              value={company.account_ownership_id ? employeeName(company.account_ownership_id) : "None"}
            />
          </div>
        </div>
      </CrmSection>

      <CrmSection title="Address Information" icon={MapPin}>
        <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          <CompanyReadOnlyField label="Billing Street *" value={textOrDash(company.billing_street)} />
          <CompanyReadOnlyField label="Shipping Street" value={textOrDash(company.shipping_street)} />
          <CompanyReadOnlyField label="Billing City *" value={textOrDash(company.billing_city)} />
          <CompanyReadOnlyField label="Shipping City" value={textOrDash(company.shipping_city)} />
          <CompanyReadOnlyField label="Billing State *" value={textOrDash(company.billing_state)} />
          <CompanyReadOnlyField label="Shipping State" value={textOrDash(company.shipping_state)} />
          <CompanyReadOnlyField label="Billing Code *" value={textOrDash(company.billing_code)} />
          <CompanyReadOnlyField label="Shipping Code" value={textOrDash(company.shipping_code)} />
          <CompanyReadOnlyField label="Billing Country *" value={textOrDash(company.billing_country)} />
          <CompanyReadOnlyField label="Shipping Country" value={textOrDash(company.shipping_country)} />
        </div>
      </CrmSection>

      <CrmSection title="Description Information" icon={FileText}>
        <FinanceField label="Description">
          <div className="flex min-h-[72px] w-full rounded-lg border border-input bg-muted/20 px-2.5 py-2 text-sm whitespace-pre-wrap text-foreground">
            {textOrDash(company.description)}
          </div>
        </FinanceField>
      </CrmSection>
    </>
  );
}

export function CompanyDetailPage({ companyAccountId }: { companyAccountId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [meetings, setMeetings] = useState<CrmMeeting[]>([]);
  const [followups, setFollowups] = useState<CrmFollowup[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [ovfs, setOvfs] = useState<CompanyOvfOverviewRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [oemQuoteRows, setOemQuoteRows] = useState<DocPreviewRow[]>([]);
  const [purchaseOrderRows, setPurchaseOrderRows] = useState<DocPreviewRow[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        companyRow,
        allLeads,
        employeeOptions,
        meetingRows,
        followupRows,
        opportunityRows,
        quoteRows,
        ovfRows,
        contactRows,
        oemAttachments,
        poAttachments,
      ] = await Promise.all([
        getCompany(companyAccountId),
        listSalesLeads(companyAccountId).catch(() => [] as SalesLead[]),
        listCrmMemberOptions().catch(() => [] as Option[]),
        listMeetings(companyAccountId).catch(() => [] as CrmMeeting[]),
        listFollowups(companyAccountId).catch(() => [] as CrmFollowup[]),
        listOpportunities({ company_account_id: companyAccountId }).catch(() => [] as Opportunity[]),
        listQuotes({ company_account_id: companyAccountId }).catch(() => [] as Quote[]),
        listOvfs({ company_account_id: companyAccountId }).catch(() => [] as Ovf[]),
        listContacts(companyAccountId).catch(() => [] as Contact[]),
        listAttachmentsByCategory("oem_quote").catch(() => []),
        listAttachmentsByCategory("customer_po").catch(() => []),
      ]);
      const scopedOpportunities = opportunityRows.filter(
        (row) => row.company_account_id === companyAccountId,
      );
      setCompany(companyRow);
      setLeads(allLeads);
      setEmployees(employeeOptions);
      setMeetings(meetingRows);
      setFollowups(followupRows);
      setOpportunities(scopedOpportunities);
      setQuotes(quoteRows.filter((row) => row.company_account_id === companyAccountId));
      const scopedOvfs = ovfRows.filter((row) => row.company_account_id === companyAccountId);
      setOvfs(await enrichCompanyOvfsWithTotals(scopedOvfs));
      setContacts(contactRows);
      setOemQuoteRows(
        buildCompanyDocumentPreviewRows(
          oemAttachments,
          scopedOpportunities,
          "oem_quote_attached",
          "OEM Quote",
        ),
      );
      setPurchaseOrderRows(
        buildCompanyDocumentPreviewRows(
          poAttachments,
          scopedOpportunities,
          "customer_po_attached",
          "Customer PO",
        ),
      );
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

  const employeeName = (id: string | null) => {
    if (!id) return "Unassigned";
    return employees.find((employee) => employee.id === id)?.label ?? "—";
  };
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
          <CompanyProfileReadOnly company={company} employeeName={employeeName} />

          <div id="company-meetings">
            <CrmListPanel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CrmIconBadge icon={CalendarDays} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold tracking-tight text-foreground">Meetings</h2>
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
              <MeetingsDataTable
                rows={meetings.slice(0, 5)}
                hostName={employeeName}
                emptyMessage='No meetings yet — use "Meeting" above to schedule one.'
              />
            </CrmListPanel>
          </div>

          <div id="company-followups">
            <CrmListPanel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CrmIconBadge icon={ClipboardList} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold tracking-tight text-foreground">Customer Follow Up</h2>
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
                    <Plus className="size-3.5" /> Create Follow Up
                  </Button>
                  <CrmViewAllLink href={`/crm/companies/${company.id}/customer-followups`} />
                </div>
              </div>
              <div className="erp-scroll overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className={CRM_TABLE_HEAD_ROW}>
                      <th className={CRM_TABLE_HEAD_CELL}>Opportunity Name</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Date</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Time</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Remark</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Task deadline</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Team Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {formatFollowupTaskDeadline(followup)}
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
                      <h2 className="text-base font-extrabold tracking-tight text-foreground">Leads</h2>
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
                    <tr className={CRM_TABLE_HEAD_ROW}>
                      <th className={CRM_TABLE_HEAD_CELL}>Lead Name</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Customer</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Status</th>
                      <th className={CRM_TABLE_HEAD_CELL}>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No leads yet for this company.
                        </td>
                      </tr>
                    ) : (
                      leads.slice(0, 5).map((lead) => (
                        <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            <Link href={`/crm/leads/${lead.id}`} className="cursor-pointer hover:underline">
                              {fullName(lead)}
                            </Link>
                            <div className="text-[11px] font-normal text-muted-foreground">{lead.lead_code}</div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {textOrDash(lead.end_customer_name ?? company.customer_name)}
                          </td>
                          <td className="px-4 py-2.5">
                            <FinanceStatusBadge status={lead.status} />
                          </td>
                          <td className="max-w-[240px] px-4 py-2.5 text-muted-foreground">
                            <span className="line-clamp-2">{textOrDash(lead.notes)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CrmListPanel>
          </div>

          <CompanyOverviewDealPanels
            companyAccountId={companyAccountId}
            companyCustomerName={company.customer_name}
            opportunities={opportunities}
            oemQuoteRows={oemQuoteRows}
            quotes={quotes}
            purchaseOrderRows={purchaseOrderRows}
            ovfs={ovfs}
            contacts={contacts}
            onDocumentsChanged={() => void load()}
          />

          <MeetingFormDialog
            open={meetingOpen}
            companyAccount={company}
            onClose={() => setMeetingOpen(false)}
            onSaved={() => void load()}
          />
          <FollowupFormDialog
            open={followupOpen}
            companyAccount={company}
            companyAccountId={company.id}
            onClose={() => setFollowupOpen(false)}
            onSaved={() => void load()}
          />
        </CrmPage>
      )}
    </CompanyWorkspaceShell>
  );
}
