import { useRouter } from "next/navigation";

import { exportCompanyPdf } from "@/lib/crm/export-company-pdf";
import { exportLeadPdf } from "@/lib/crm/export-lead-pdf";
import { exportOpportunityPdf } from "@/lib/crm/export-opportunity-pdf";
import { exportOvfPdf } from "@/lib/crm/export-ovf-pdf";
import { exportQuotePdf, loadSellerLetterhead } from "@/lib/crm/export-quote-pdf";
import { nextCloneCompanyName } from "@/lib/crm/company-clone-name";
import { ApiClientError } from "@/services/api-client";
import {
  addQuoteLine,
  companyToFormInput,
  createCompany,
  createLeadFromCompany,
  createOpportunity,
  createQuote,
  listCompanies,
  listCrmMemberOptions,
  listPipelines,
  listQuoteLines,
  type Company,
  type LeadCreateFromCompanyInput,
  type Opportunity,
  type Quote,
  type QuoteLine,
  type SalesLead,
} from "@/services/sales-crm-service";

export function salesLeadToCreateInput(lead: SalesLead): LeadCreateFromCompanyInput {
  return {
    branch_id: lead.branch_id,
    salutation: lead.salutation ?? null,
    first_name: lead.first_name,
    last_name: lead.last_name,
    designation: lead.designation ?? null,
    mobile: lead.mobile,
    email: lead.email,
    lead_source_id: lead.lead_source_id,
    owner_employee_id: lead.owner_employee_id,
    assign_to_id: lead.assign_to_id,
    assigned_date: lead.assigned_date ?? null,
    expected_amount: lead.expected_amount,
    expected_closure_date: lead.expected_closure_date,
    product_type: lead.product_type,
    sub_product_category: lead.sub_product_category,
    sub_product: lead.sub_product,
    sub_product_other: lead.sub_product_other,
    engagement_score: lead.engagement_score ?? null,
    portal_link: lead.portal_link ?? null,
    project_title: lead.project_title ? `${lead.project_title} (Copy)` : "Copy",
    requirement_type: lead.requirement_type ?? null,
    purchase_model: lead.purchase_model ?? null,
    dr_number: lead.dr_number ?? null,
    new_dr_number: lead.new_dr_number ?? null,
    deal_type: lead.deal_type ?? null,
    industry: lead.industry ?? null,
    territory: lead.territory ?? null,
    region: lead.region ?? null,
    street: lead.street ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    zip: lead.zip ?? null,
    country: lead.country ?? null,
    oem_name: lead.oem_name ?? "—",
    oem_contact_person: lead.oem_contact_person ?? null,
    oem_contact_number: lead.oem_contact_number ?? null,
    oem_contact_email: lead.oem_contact_email ?? null,
    distributor_name: lead.distributor_name ?? null,
    distributor_contact: lead.distributor_contact ?? null,
    distributor_contact_person: lead.distributor_contact_person ?? null,
    distributor_contact_email: lead.distributor_contact_email ?? null,
    distributor_department: lead.distributor_department ?? null,
    end_customer_name: lead.end_customer_name ?? null,
    end_customer_location: lead.end_customer_location ?? null,
    entity_name: lead.entity_name,
    entity_email: lead.entity_email,
    entity_address: lead.entity_address,
    entity_gst: lead.entity_gst,
    entity_contact: lead.entity_contact,
    notes: lead.notes,
  };
}

export async function cloneCompanyRecord(company: Company, router: ReturnType<typeof useRouter>) {
  const all = await listCompanies();
  const cloneName = nextCloneCompanyName(company, all);
  const cloned = await createCompany(companyToFormInput(company, cloneName));
  router.push(`/crm/companies/${cloned.id}`);
}

export async function printCompanyPreview(company: Company) {
  const employees = await listCrmMemberOptions().catch(() => []);
  const nameFor = (id: string | null) => {
    if (!id) return "—";
    return employees.find((e) => e.id === id)?.label ?? "—";
  };
  exportCompanyPdf({
    company,
    accountManagerName: nameFor(company.account_owner_id),
    assignedOwnershipName: company.account_ownership_id
      ? nameFor(company.account_ownership_id)
      : "None",
    createdByName: nameFor(company.account_owner_id),
    modifiedByName: nameFor(company.account_owner_id),
  });
}

export async function cloneLeadRecord(lead: SalesLead, router: ReturnType<typeof useRouter>) {
  if (!lead.company_account_id) {
    throw new ApiClientError("Lead must belong to a company account to clone", 409);
  }
  const cloned = await createLeadFromCompany(lead.company_account_id, salesLeadToCreateInput(lead));
  router.push(`/crm/leads/${cloned.id}`);
}

export function printLeadPreview(lead: SalesLead, companyName?: string | null) {
  exportLeadPdf(lead, companyName);
}

export async function cloneOpportunityRecord(
  opportunity: Opportunity,
  router: ReturnType<typeof useRouter>,
) {
  const pipelines = await listPipelines();
  const pipeline = pipelines[0];
  if (!pipeline) {
    throw new ApiClientError("No sales pipeline configured for cloning", 409);
  }
  const cloned = await createOpportunity({
    branch_id: opportunity.branch_id,
    opportunity_name: `${opportunity.opportunity_name} (Copy)`,
    pipeline_id: pipeline.id,
    owner_employee_id: opportunity.owner_employee_id,
    lead_id: opportunity.lead_id,
    expected_revenue: opportunity.expected_revenue,
    probability_percent: opportunity.probability_percent,
    current_stage: "qualification",
  });
  router.push(`/crm/opportunities/${cloned.id}`);
}

export function printOpportunityPreview(opportunity: Opportunity) {
  exportOpportunityPdf(opportunity);
}

export async function cloneQuoteRecord(
  quote: Quote,
  lines: QuoteLine[],
  router: ReturnType<typeof useRouter>,
) {
  const cloned = await createQuote({
    opportunity_id: quote.opportunity_id,
    branch_id: quote.branch_id,
    contact_id: quote.contact_id,
    subject: quote.subject ? `${quote.subject} (Copy)` : "Copy",
    project_title: quote.project_title,
    account_name: quote.account_name,
    service_type: quote.service_type,
    owner_name: quote.owner_name,
    valid_until: quote.valid_until,
    entity_name: quote.entity_name,
    entity_email: quote.entity_email,
    entity_address: quote.entity_address,
    entity_gst: quote.entity_gst,
    entity_contact: quote.entity_contact,
    billing_country: quote.billing_country,
    shipping_country: quote.shipping_country,
    freight: quote.freight,
    terms: quote.terms,
    description: quote.description,
    reason_for_discount: quote.reason_for_discount,
  });
  for (const line of lines) {
    await addQuoteLine(cloned.id, {
      product_id: line.product_id,
      product_name: line.product_name,
      hsn_sac: line.hsn_sac,
      description: line.description,
      line_type: line.line_type,
      qty: line.qty,
      unit_cost: line.unit_cost,
      unit_sell: line.unit_sell,
      gst_pct: line.gst_pct,
    });
  }
  router.push(`/crm/quotes/${cloned.id}`);
}

export async function printQuotePreview(quote: Quote, lines: QuoteLine[]) {
  const seller = await loadSellerLetterhead(quote.company_id, quote.branch_id);
  await exportQuotePdf({
    quote,
    lines,
    seller,
    customerName: quote.entity_name || quote.account_name || "—",
    customerAddress: quote.entity_address || "—",
    subject: quote.subject || quote.project_title || quote.quote_no,
    ownerName: quote.owner_name || "—",
    termsOverride: quote.terms,
  });
}

export async function cloneOvfRecord() {
  throw new ApiClientError("Only one OVF is allowed per opportunity; cloning is not supported.", 409);
}

export async function printOvfPreview(
  input: Parameters<typeof exportOvfPdf>[0],
) {
  exportOvfPdf(input);
}
