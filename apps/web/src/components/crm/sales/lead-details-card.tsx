"use client";

import {
  Building2,
  Handshake,
  MessageSquareText,
  MapPin,
  Package,
  Truck,
  UserPlus,
} from "lucide-react";

import { CRM_TABLE_HEAD_CELL, CRM_TABLE_HEAD_ROW, CrmSection } from "@/components/crm/crm-ui";
import { CrmCustomFieldsReadOnly } from "@/components/crm/sales/crm-custom-fields-section";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import {
  LeadPresalesCallSection,
} from "@/components/crm/sales/lead-presales-call-section";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { isEventLeadSourceLabel, isMultiTierLeadSourceLabel } from "@/lib/crm/company-lead-sources";
import { pageSectionVisible } from "@/lib/crm/crm-settings-ui";
import {
  displayLeadSourcingChannels,
  leadNeedsHardwareSourcing,
  leadNeedsServiceSourcing,
  parseLeadSourcingChannels,
} from "@/lib/crm/lead-sourcing-channels";
import { parseLeadProductTypes } from "@/lib/crm/lead-product-options";
import {
  parseDistributorPartnerRows,
  parseOemPartnerRows,
  type LeadPartnerRow,
} from "@/lib/crm/lead-partner-rows";

import {
  formatInr,
  fullName,
  type Company,
  type Option,
  type SalesLead,
} from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
}

function PartnerRowsReadOnly({
  title,
  icon: Icon,
  nameLabel,
  rows,
}: {
  title: string;
  icon: typeof Package;
  nameLabel: string;
  rows: LeadPartnerRow[];
}) {
  return (
    <CrmSection title={title} icon={Icon}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className={CRM_TABLE_HEAD_CELL}>{nameLabel}</th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Person</th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Number</th>
                <th className={CRM_TABLE_HEAD_CELL}>Contact Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-3 py-2">{textOrDash(row.name)}</td>
                  <td className="px-3 py-2">{textOrDash(row.contact_person)}</td>
                  <td className="px-3 py-2">{textOrDash(row.contact_number)}</td>
                  <td className="px-3 py-2">{textOrDash(row.contact_email)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmSection>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="flex min-h-8 w-full items-center rounded-lg border border-input bg-muted/20 px-2.5 text-sm text-foreground">
      {value}
    </div>
  );
}

function LeadReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FinanceField label={label}>
      <ReadOnlyValue value={value} />
    </FinanceField>
  );
}

function formatLeadStatus(lead: SalesLead): string {
  if (
    lead.status === "converted" ||
    lead.blueprint_state === "converted" ||
    Boolean(lead.converted_opportunity_id)
  ) {
    return "Converted to Opportunity";
  }
  if (lead.status === "new") return "New";
  return lead.status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Props = {
  lead: SalesLead;
  company?: Company | null;
  /** Head-office GSTIN from company GST registrations. */
  companyGstin?: string | null;
  employees?: Option[];
  leadSources?: Option[];
  marketingEvents?: Option[];
  /** Section heading - use Opportunity Information on converted deals. */
  title?: string;
  /** Merge first/last into one Full Name field (opportunity view). */
  mergeFullName?: boolean;
  /** Show PreSales call gate above Lead Information (lead detail only). */
  showPresalesCallGate?: boolean;
  onLeadUpdated?: (lead: SalesLead) => void;
};

export function LeadDetailsCard({
  lead,
  company,
  companyGstin,
  employees = [],
  leadSources = [],
  marketingEvents = [],
  title = "Lead Information",
  mergeFullName = false,
  showPresalesCallGate = false,
  onLeadUpdated,
}: Props) {
  const { settings } = useCrmSettingsEffective();
  const showSummary = pageSectionVisible(settings, "lead_detail", "summary", true);
  const showPresales = pageSectionVisible(settings, "lead_detail", "presales_call", true);
  const showBoqSow = pageSectionVisible(settings, "lead_detail", "boq_sow", true);
  const showActivity = pageSectionVisible(settings, "lead_detail", "activity", true);

  const employeeName = (id: string | null | undefined) => {
    if (!id) return "None";
    return employees.find((employee) => employee.id === id)?.label ?? "-";
  };

  const leadSourceName = (id: string | null | undefined) => {
    if (!id) return "None";
    return leadSources.find((source) => source.id === id)?.label ?? "-";
  };

  const companyName = company?.customer_name ?? "-";
  const salutation = lead.salutation?.trim() || "";
  const displayFullName = [salutation, fullName(lead) === "-" ? null : fullName(lead)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const productTypes = parseLeadProductTypes(lead.product_type);
  const sourcingChannels = parseLeadSourcingChannels(lead.deal_type);
  const showHardwareSourcing = leadNeedsHardwareSourcing(productTypes);
  const showServiceSourcing = leadNeedsServiceSourcing(productTypes);

  return (
    <div className="space-y-5">
      {showPresales && showPresalesCallGate && onLeadUpdated ? (
        <LeadPresalesCallSection lead={lead} onSaved={onLeadUpdated} />
      ) : null}

      {showSummary ? (
        <>
          <CrmSection title={title} icon={UserPlus}>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <LeadReadOnlyField label="DR Number" value={textOrDash(lead.dr_number || lead.lead_code)} />
              <LeadReadOnlyField label="Company" value={companyName} />
              <LeadReadOnlyField label="Project Title *" value={textOrDash(lead.project_title)} />

              {mergeFullName ? (
                <LeadReadOnlyField
                  label="Full Name *"
                  value={textOrDash(displayFullName)}
                />
              ) : (
                <>
                  <LeadReadOnlyField label="First Name *" value={textOrDash(lead.first_name)} />
                  <LeadReadOnlyField label="Last Name *" value={textOrDash(lead.last_name)} />
                </>
              )}

              <LeadReadOnlyField label="Email *" value={textOrDash(lead.email)} />
              <LeadReadOnlyField label="Mobile *" value={textOrDash(lead.mobile)} />

              <LeadReadOnlyField label="Designation *" value={textOrDash(lead.designation)} />
              <LeadReadOnlyField label="Lead Source *" value={leadSourceName(lead.lead_source_id)} />
              {isMultiTierLeadSourceLabel(leadSourceName(lead.lead_source_id)) ? (
                <LeadReadOnlyField label="Partner Names *" value={textOrDash(lead.partner_names)} />
              ) : null}
              {isEventLeadSourceLabel(leadSourceName(lead.lead_source_id)) ? (
                <LeadReadOnlyField
                  label="Event *"
                  value={textOrDash(
                    marketingEvents.find((event) => event.id === lead.marketing_event_id)?.label,
                  )}
                />
              ) : null}

              <LeadReadOnlyField label="Product Type *" value={textOrDash(lead.product_type)} />

              <LeadReadOnlyField
                label="Sub Product Category *"
                value={textOrDash(lead.sub_product_category)}
              />
              <LeadReadOnlyField label="Requirement Type *" value={textOrDash(lead.requirement_type)} />

              <LeadReadOnlyField label="Sub Product" value={textOrDash(lead.sub_product)} />
              <LeadReadOnlyField label="Purchase Model *" value={textOrDash(lead.purchase_model)} />

              <LeadReadOnlyField
                label="Engagement Score"
                value={
                  lead.engagement_score != null ? `${lead.engagement_score}%` : textOrDash(lead.engagement_score)
                }
              />

              {showHardwareSourcing ? (
                <LeadReadOnlyField
                  label="Hardware Sourcing Channel *"
                  value={
                    sourcingChannels.hardware && sourcingChannels.hardware.length > 0
                      ? sourcingChannels.hardware.join(", ")
                      : "-"
                  }
                />
              ) : null}
              {showServiceSourcing ? (
                <LeadReadOnlyField
                  label="Service Sourcing Channel *"
                  value={textOrDash(sourcingChannels.service)}
                />
              ) : null}
              {!showHardwareSourcing && !showServiceSourcing ? (
                <LeadReadOnlyField
                  label="Sourcing Channel"
                  value={displayLeadSourcingChannels(lead.deal_type, lead.product_type)}
                />
              ) : null}
              <LeadReadOnlyField label="Lead Owner *" value={employeeName(lead.owner_employee_id)} />

              <LeadReadOnlyField
                label="Expected Order Value *"
                value={lead.expected_amount != null ? formatInr(lead.expected_amount) : "-"}
              />
              <LeadReadOnlyField label="Status" value={formatLeadStatus(lead)} />

              <LeadReadOnlyField
                label="Expected Closure Date *"
                value={textOrDash(lead.expected_closure_date)}
              />
              <LeadReadOnlyField
                label="Presales Owner"
                value={employeeName(lead.presales_owner_id)}
              />
            </div>
          </CrmSection>

          <CrmSection title="Customer Address Information" icon={MapPin}>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <LeadReadOnlyField label="Street" value={textOrDash(lead.street)} />
              <LeadReadOnlyField label="City" value={textOrDash(lead.city)} />
              <LeadReadOnlyField label="State" value={textOrDash(lead.state)} />
              <LeadReadOnlyField label="Zip Code" value={textOrDash(lead.zip)} />
              <LeadReadOnlyField label="Country" value={textOrDash(lead.country)} />
              <LeadReadOnlyField label="GST Number" value={textOrDash(companyGstin)} />
            </div>
          </CrmSection>

          <PartnerRowsReadOnly
            title="OEM Information"
            icon={Package}
            nameLabel="OEM Name"
            rows={parseOemPartnerRows(lead).filter((row) => row.name.trim())}
          />

          <PartnerRowsReadOnly
            title="Distributor Information"
            icon={Truck}
            nameLabel="Distributor Name"
            rows={parseDistributorPartnerRows(lead).filter((row) => row.name.trim())}
          />

          <CrmSection title="Sale Type" icon={Handshake}>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <LeadReadOnlyField
                label="Sale Type *"
                value={
                  (lead.sale_type || "").trim().toLowerCase() === "sell_to"
                    ? "Sell To"
                    : (lead.sale_type || "").trim().toLowerCase() === "sell_through"
                      ? "Sell Through"
                      : lead.end_customer_name
                        ? companyName &&
                          lead.end_customer_name.trim().toLowerCase() ===
                          companyName.trim().toLowerCase()
                          ? "Sell To"
                          : "Sell Through"
                        : "-"
                }
              />
              {(lead.sale_type || "").trim().toLowerCase() === "sell_to" ||
                (companyName &&
                  (lead.end_customer_name || "").trim().toLowerCase() ===
                  companyName.trim().toLowerCase()) ? (
                <LeadReadOnlyField label="Account Name" value={textOrDash(companyName)} />
              ) : (
                <LeadReadOnlyField
                  label="End Customer Name *"
                  value={textOrDash(lead.end_customer_name)}
                />
              )}
            </div>
          </CrmSection>

          <CrmSection title="Cache Legal Entity" icon={Building2}>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              <LeadReadOnlyField label="Entity Name *" value={textOrDash(lead.entity_name)} />
              <LeadReadOnlyField label="Entity Email" value={textOrDash(lead.entity_email)} />
              <LeadReadOnlyField label="Entity Address *" value={textOrDash(lead.entity_address)} />
              <LeadReadOnlyField label="Organization" value={companyName} />
              <LeadReadOnlyField label="Entity GST No." value={textOrDash(lead.entity_gst)} />
              <LeadReadOnlyField
                label="Entity Contact Number"
                value={textOrDash(lead.entity_contact)}
              />
            </div>
          </CrmSection>
        </>
      ) : null}

      {showBoqSow ? (
        <CrmSection title="BOQ & SOW Requirements" icon={Package}>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            <LeadReadOnlyField
              label="BOQ required"
              value={
                lead.requires_boq
                  ? lead.boq_attached
                    ? "Yes — attached"
                    : "Yes — awaiting attachment"
                  : "No"
              }
            />
            <LeadReadOnlyField
              label="SOW required"
              value={
                lead.requires_sow
                  ? lead.sow_attached
                    ? "Yes — attached"
                    : "Yes — awaiting attachment"
                  : "No"
              }
            />
          </div>
        </CrmSection>
      ) : null}

      <CrmCustomFieldsReadOnly entity="lead" values={lead.custom_fields} />

      {showActivity ? (
        <CrmSection title="Lead Remarks" icon={MessageSquareText}>
          <FinanceField label="Remarks">
            <div className="flex min-h-[96px] w-full rounded-lg border border-input bg-muted/20 px-2.5 py-2 text-sm whitespace-pre-wrap text-foreground">
              {textOrDash(lead.notes)}
            </div>
          </FinanceField>
        </CrmSection>
      ) : null}
    </div>
  );
}
