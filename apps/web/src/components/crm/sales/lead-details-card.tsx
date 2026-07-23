"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { formatInr, fullName, type Company, type Option, type SalesLead } from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

type Props = {
  lead: SalesLead;
  company?: Company | null;
  employees?: Option[];
  /** Compact header actions (e.g. link back to lead). */
  headerAction?: ReactNode;
};

export function LeadDetailsCard({ lead, company, employees = [], headerAction }: Props) {
  const employeeName = (id: string | null | undefined) =>
    id ? employees.find((employee) => employee.id === id)?.label ?? id : "—";

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">
          Lead Details
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {fullName(lead)} · {lead.lead_code}
          </span>
        </h2>
        {headerAction}
      </div>

      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Lead Information
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="Lead Code">{lead.lead_code}</DetailItem>
        <DetailItem label="Blueprint State">
          <BlueprintStateBadge state={lead.blueprint_state} />
        </DetailItem>
        <DetailItem label="Status">
          <FinanceStatusBadge status={lead.status} />
        </DetailItem>
        <DetailItem label="Salutation">{textOrDash(lead.salutation)}</DetailItem>
        <DetailItem label="First Name">{textOrDash(lead.first_name)}</DetailItem>
        <DetailItem label="Last Name">{textOrDash(lead.last_name)}</DetailItem>
        <DetailItem label="Mobile">{textOrDash(lead.mobile)}</DetailItem>
        <DetailItem label="Email">{textOrDash(lead.email)}</DetailItem>
        <DetailItem label="Owner">{employeeName(lead.owner_employee_id)}</DetailItem>
        <DetailItem label="Assign To">{employeeName(lead.assign_to_id)}</DetailItem>
        <DetailItem label="Assigned Date">{textOrDash(lead.assigned_date)}</DetailItem>
        <DetailItem label="Company Account">
          {lead.company_account_id ? (
            <Link
              href={`/crm/companies/${lead.company_account_id}`}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              {company?.customer_name ?? lead.company_account_id}
            </Link>
          ) : (
            "—"
          )}
        </DetailItem>
        <DetailItem label="Expected Amount">
          {lead.expected_amount != null ? formatInr(lead.expected_amount) : "—"}
        </DetailItem>
        <DetailItem label="Expected Closure">{textOrDash(lead.expected_closure_date)}</DetailItem>
        <DetailItem label="Engagement Score">{textOrDash(lead.engagement_score)}</DetailItem>
        <DetailItem label="Portal Link">{textOrDash(lead.portal_link)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Opportunity / Product
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="Project Title">{textOrDash(lead.project_title)}</DetailItem>
        <DetailItem label="Product Type">{textOrDash(lead.product_type)}</DetailItem>
        <DetailItem label="Sub Product Category">{textOrDash(lead.sub_product_category)}</DetailItem>
        <DetailItem label="Sub Product">{textOrDash(lead.sub_product)}</DetailItem>
        <DetailItem label="Sub Product Other">{textOrDash(lead.sub_product_other)}</DetailItem>
        <DetailItem label="Requirement Type">{textOrDash(lead.requirement_type)}</DetailItem>
        <DetailItem label="Purchase Model">{textOrDash(lead.purchase_model)}</DetailItem>
        <DetailItem label="Deal Type">{textOrDash(lead.deal_type)}</DetailItem>
        <DetailItem label="DR Number">{textOrDash(lead.dr_number)}</DetailItem>
        <DetailItem label="New DR Number">{textOrDash(lead.new_dr_number)}</DetailItem>
        <DetailItem label="Industry">{textOrDash(lead.industry)}</DetailItem>
        <DetailItem label="Territory">{textOrDash(lead.territory)}</DetailItem>
        <DetailItem label="Region">{textOrDash(lead.region)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Address
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="Street">{textOrDash(lead.street)}</DetailItem>
        <DetailItem label="City">{textOrDash(lead.city)}</DetailItem>
        <DetailItem label="State">{textOrDash(lead.state)}</DetailItem>
        <DetailItem label="Zip">{textOrDash(lead.zip)}</DetailItem>
        <DetailItem label="Country">{textOrDash(lead.country)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        OEM
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="OEM Name">{textOrDash(lead.oem_name)}</DetailItem>
        <DetailItem label="OEM Contact Person">{textOrDash(lead.oem_contact_person)}</DetailItem>
        <DetailItem label="OEM Contact Number">{textOrDash(lead.oem_contact_number)}</DetailItem>
        <DetailItem label="OEM Contact Email">{textOrDash(lead.oem_contact_email)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Distributor
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="Distributor Name">{textOrDash(lead.distributor_name)}</DetailItem>
        <DetailItem label="Contact Person">{textOrDash(lead.distributor_contact_person)}</DetailItem>
        <DetailItem label="Contact">{textOrDash(lead.distributor_contact)}</DetailItem>
        <DetailItem label="Contact Email">{textOrDash(lead.distributor_contact_email)}</DetailItem>
        <DetailItem label="Department">{textOrDash(lead.distributor_department)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        End Customer
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="End Customer Name">{textOrDash(lead.end_customer_name)}</DetailItem>
        <DetailItem label="End Customer Location">{textOrDash(lead.end_customer_location)}</DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Entity
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
        <DetailItem label="Entity Name">{textOrDash(lead.entity_name)}</DetailItem>
        <DetailItem label="Entity Email">{textOrDash(lead.entity_email)}</DetailItem>
        <DetailItem label="Entity Contact">{textOrDash(lead.entity_contact)}</DetailItem>
        <DetailItem label="Entity GST">{textOrDash(lead.entity_gst)}</DetailItem>
        <DetailItem label="Entity Address">
          <span className="whitespace-pre-wrap">{textOrDash(lead.entity_address)}</span>
        </DetailItem>
      </dl>

      <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Notes
      </h3>
      <dl className="grid gap-3 text-xs">
        <DetailItem label="Notes">
          <span className="whitespace-pre-wrap">{textOrDash(lead.notes)}</span>
        </DetailItem>
        <DetailItem label="Convert Remark">
          <span className="whitespace-pre-wrap">{textOrDash(lead.convert_remark)}</span>
        </DetailItem>
        <DetailItem label="Lost Reason">{textOrDash(lead.lost_reason)}</DetailItem>
      </dl>
    </section>
  );
}
