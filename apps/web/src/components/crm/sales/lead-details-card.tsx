"use client";

import { Building2, FileText, MapPin, Package, Truck, UserPlus, Users } from "lucide-react";

import { CrmSection } from "@/components/crm/crm-ui";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { formatInr, type Company, type Option, type SalesLead } from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
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

function formatLeadStatus(status: string): string {
  if (status === "new") return "New";
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Props = {
  lead: SalesLead;
  company?: Company | null;
  employees?: Option[];
  leadSources?: Option[];
};

export function LeadDetailsCard({
  lead,
  company,
  employees = [],
  leadSources = [],
}: Props) {
  const employeeName = (id: string | null | undefined) => {
    if (!id) return "None";
    return employees.find((employee) => employee.id === id)?.label ?? "—";
  };

  const leadSourceName = (id: string | null | undefined) => {
    if (!id) return "None";
    return leadSources.find((source) => source.id === id)?.label ?? "—";
  };

  const companyName = company?.customer_name ?? "—";
  const salutation = lead.salutation?.trim() || "—";

  return (
    <div className="space-y-5">
      <CrmSection title="Lead Information" icon={UserPlus}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <LeadReadOnlyField label="Company" value={companyName} />
          <LeadReadOnlyField
            label="Project Title *"
            value={textOrDash(lead.project_title)}
          />

          <FinanceField label="First Name *">
            <div className="flex gap-2">
              <div className="w-14 shrink-0">
                <ReadOnlyValue value={salutation} />
              </div>
              <div className="min-w-0 flex-1">
                <ReadOnlyValue value={textOrDash(lead.first_name)} />
              </div>
            </div>
          </FinanceField>
          <LeadReadOnlyField label="Last Name *" value={textOrDash(lead.last_name)} />

          <LeadReadOnlyField label="Email *" value={textOrDash(lead.email)} />
          <LeadReadOnlyField label="Mobile *" value={textOrDash(lead.mobile)} />

          <LeadReadOnlyField label="Designation" value={textOrDash(lead.designation)} />
          <LeadReadOnlyField label="Lead Source *" value={leadSourceName(lead.lead_source_id)} />

          <LeadReadOnlyField label="Product Type *" value={textOrDash(lead.product_type)} />

          <LeadReadOnlyField
            label="Sub Product Category"
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
          <LeadReadOnlyField label="DR Number" value={textOrDash(lead.dr_number)} />

          <LeadReadOnlyField label="Sourcing Channel" value={textOrDash(lead.deal_type)} />
          <LeadReadOnlyField label="Lead Owner *" value={employeeName(lead.owner_employee_id)} />

          <LeadReadOnlyField
            label="Expected Order Value *"
            value={lead.expected_amount != null ? formatInr(lead.expected_amount) : "—"}
          />
          <LeadReadOnlyField label="Lead Status" value={formatLeadStatus(lead.status)} />

          <LeadReadOnlyField
            label="Expected Closure Date *"
            value={textOrDash(lead.expected_closure_date)}
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
        </div>
      </CrmSection>

      <CrmSection title="OEM Information" icon={Package}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <LeadReadOnlyField label="OEM Name *" value={textOrDash(lead.oem_name)} />
          <LeadReadOnlyField label="OEM Contact Person" value={textOrDash(lead.oem_contact_person)} />
          <LeadReadOnlyField label="OEM Contact Number" value={textOrDash(lead.oem_contact_number)} />
          <LeadReadOnlyField label="OEM Contact Email" value={textOrDash(lead.oem_contact_email)} />
        </div>
      </CrmSection>

      <CrmSection title="Distributor Information" icon={Truck}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <LeadReadOnlyField label="Distributor Name" value={textOrDash(lead.distributor_name)} />
          <LeadReadOnlyField
            label="Distributor Contact Person"
            value={textOrDash(lead.distributor_contact_person)}
          />
          <LeadReadOnlyField
            label="Distributor Contact Number"
            value={textOrDash(lead.distributor_contact)}
          />
          <LeadReadOnlyField
            label="Distributor Contact Email"
            value={textOrDash(lead.distributor_contact_email)}
          />
        </div>
      </CrmSection>

      <CrmSection title="End Customer Detail" icon={Users}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <LeadReadOnlyField label="End Customer *" value={textOrDash(lead.end_customer_name)} />
          <LeadReadOnlyField label="Industry" value={textOrDash(lead.industry) || "None"} />
        </div>
      </CrmSection>

      <CrmSection title="Entity Information" icon={Building2}>
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

      <CrmSection title="Additional Information" icon={FileText}>
        <FinanceField label="Description">
          <div className="flex min-h-[72px] w-full rounded-lg border border-input bg-muted/20 px-2.5 py-2 text-sm whitespace-pre-wrap text-foreground">
            {textOrDash(lead.notes)}
          </div>
        </FinanceField>
      </CrmSection>
    </div>
  );
}
