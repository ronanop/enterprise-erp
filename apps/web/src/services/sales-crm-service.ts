/**
 * Typed wrappers for the Sales CRM (Zoho-replacement) API surface — Companies,
 * Contacts, Products, Quotes, OVF, My Jobs, Attachments, and the sales
 * blueprint state machine (lead / opportunity / quote / ovf).
 *
 * All calls go through the shared `apiClient` / `resourceService` — the UI
 * never talks to the database directly (DG-01).
 */
import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

function asArray<T>(data: T[] | T | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data == null) return [];
  return [data];
}

function unwrap<T>(res: { data: T | null }): T {
  if (res.data == null) {
    throw new ApiClientError("Empty response from server", 500);
  }
  return res.data;
}

export function formatInr(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? (n as number) : 0);
}

export function formatInrPrecise(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? (n as number) : 0);
}

export function truncateId(id?: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

export function fullName(row: { first_name?: string | null; last_name?: string | null }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const marker = "base64,";
      const idx = result.indexOf(marker);
      resolve(idx >= 0 ? result.slice(idx + marker.length) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Shared blueprint types
// ---------------------------------------------------------------------------

export type BlueprintEntity = "lead" | "opportunity" | "quote" | "ovf";

export type BlueprintState = {
  entity_type: string;
  entity_id: string;
  state: string;
  locked: boolean;
  allowed_actions: string[];
  is_sales_blueprint?: boolean | null;
};

export type BlueprintActionPayload = {
  file_name?: string;
  file_path?: string;
  content_base64?: string;
  content_type?: string;
  team_role?: string;
  remarks?: string;
  remark?: string;
  reason?: string;
  deal_reg_number?: string;
  valid_until?: string;
  deal_won_amount?: number;
};

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const CRM_COMPANIES_API = "/crm/companies";

export type Company = {
  id: string;
  company_id: string;
  branch_id: string;
  account_number: string;
  customer_name: string;
  account_owner_id: string | null;
  account_type: string | null;
  industry: string;
  other_industries: string | null;
  portal_id: string | null;
  source: string;
  rating: string | null;
  first_name: string | null;
  last_name: string | null;
  customer_email: string | null;
  phone: string | null;
  website: string | null;
  account_ownership_id: string | null;
  customer_id_ext: string | null;
  role: string | null;
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_code: string;
  billing_country: string;
  shipping_street: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_code: string | null;
  shipping_country: string | null;
  description: string | null;
  master_customer_id: string | null;
  status: string;
  locked: boolean;
  version: number;
};

export type CompanyFormInput = {
  branch_id: string;
  customer_name: string;
  account_owner_id?: string | null;
  account_type?: string | null;
  industry: string;
  other_industries?: string | null;
  portal_id?: string | null;
  source: string;
  rating?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_email?: string | null;
  phone?: string | null;
  website?: string | null;
  account_ownership_id?: string | null;
  customer_id_ext?: string | null;
  role?: string | null;
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_code: string;
  billing_country: string;
  shipping_street?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_code?: string | null;
  shipping_country?: string | null;
  description?: string | null;
};

export async function listCompanies(): Promise<Company[]> {
  const res = await resourceService.list<Company>(CRM_COMPANIES_API);
  return asArray(res.data);
}

export async function getCompany(id: string): Promise<Company> {
  return unwrap(await resourceService.get<Company>(CRM_COMPANIES_API, id));
}

export async function createCompany(body: CompanyFormInput): Promise<Company> {
  return unwrap(await resourceService.create<Company>(CRM_COMPANIES_API, body));
}

export async function updateCompany(id: string, body: Partial<CompanyFormInput>): Promise<Company> {
  return unwrap(await resourceService.update<Company>(CRM_COMPANIES_API, id, body));
}

export type LeadCreateFromCompanyInput = {
  branch_id: string;
  first_name?: string | null;
  last_name?: string | null;
  salutation?: string | null;
  mobile?: string | null;
  email?: string | null;
  lead_source_id: string;
  owner_employee_id: string;
  assign_to_id?: string | null;
  expected_amount?: number | null;
  expected_closure_date?: string | null;
  product_type?: string | null;
  sub_product_category?: string | null;
  sub_product?: string | null;
  sub_product_other?: string | null;
  project_title?: string | null;
  requirement_type?: string | null;
  purchase_model?: string | null;
  deal_type?: string | null;
  industry?: string | null;
  territory?: string | null;
  region?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  oem_name?: string | null;
  oem_contact_person?: string | null;
  oem_contact_number?: string | null;
  oem_contact_email?: string | null;
  distributor_name?: string | null;
  distributor_contact?: string | null;
  end_customer_name?: string | null;
  end_customer_location?: string | null;
  entity_name?: string | null;
  entity_email?: string | null;
  entity_address?: string | null;
  entity_gst?: string | null;
  entity_contact?: string | null;
  notes?: string | null;
};

export async function createLeadFromCompany(
  companyAccountId: string,
  body: LeadCreateFromCompanyInput,
): Promise<SalesLead> {
  return unwrap(
    await apiClient<SalesLead>(`${CRM_COMPANIES_API}/${companyAccountId}/leads`, {
      method: "POST",
      body,
    }),
  );
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const CRM_CONTACTS_API = "/crm/contacts";

export type Contact = {
  id: string;
  company_account_id: string;
  company_id: string;
  branch_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  is_primary: boolean;
  owner_id: string | null;
  status: string;
  version: number;
};

export type ContactFormInput = {
  company_account_id: string;
  branch_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  title?: string | null;
  is_primary?: boolean;
  owner_id?: string | null;
};

export async function listContacts(companyAccountId?: string): Promise<Contact[]> {
  const res = await resourceService.list<Contact>(CRM_CONTACTS_API, {
    company_account_id: companyAccountId,
  });
  return asArray(res.data);
}

export async function createContact(body: ContactFormInput): Promise<Contact> {
  return unwrap(await resourceService.create<Contact>(CRM_CONTACTS_API, body));
}

export async function updateContact(id: string, body: Partial<ContactFormInput>): Promise<Contact> {
  return unwrap(await resourceService.update<Contact>(CRM_CONTACTS_API, id, body));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const CRM_PRODUCTS_API = "/crm/products";

export type Product = {
  id: string;
  company_id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  hsn_sac: string | null;
  unit_price: number;
  status: string;
  version: number;
};

export type ProductFormInput = {
  product_code?: string | null;
  product_name: string;
  product_type: string;
  hsn_sac?: string | null;
  unit_price?: number;
  status?: string;
};

export async function listProducts(): Promise<Product[]> {
  const res = await resourceService.list<Product>(CRM_PRODUCTS_API);
  return asArray(res.data);
}

export async function createProduct(body: ProductFormInput): Promise<Product> {
  return unwrap(await resourceService.create<Product>(CRM_PRODUCTS_API, body));
}

export async function updateProduct(id: string, body: Partial<ProductFormInput>): Promise<Product> {
  return unwrap(await resourceService.update<Product>(CRM_PRODUCTS_API, id, body));
}

// ---------------------------------------------------------------------------
// Sales Leads (legacy /crm/leads endpoints, filtered to sales-blueprint rows)
// ---------------------------------------------------------------------------

export const CRM_LEADS_API = "/crm/leads";

export type SalesLead = {
  id: string;
  company_id: string;
  branch_id: string;
  lead_code: string;
  first_name: string;
  last_name: string | null;
  mobile: string;
  email: string | null;
  status: string;
  blueprint_state: string;
  locked: boolean;
  company_account_id: string | null;
  owner_employee_id: string;
  assign_to_id: string | null;
  expected_amount: number | null;
  expected_closure_date: string | null;
  converted_opportunity_id: string | null;
  version: number;
};

export async function listSalesLeads(): Promise<SalesLead[]> {
  const res = await resourceService.list<SalesLead>(CRM_LEADS_API);
  return asArray(res.data).filter((row) => Boolean(row.company_account_id));
}

export async function getSalesLead(id: string): Promise<SalesLead> {
  return unwrap(await resourceService.get<SalesLead>(CRM_LEADS_API, id));
}

export async function getLeadBlueprint(id: string): Promise<BlueprintState> {
  return unwrap(await apiClient<BlueprintState>(`${CRM_LEADS_API}/${id}/blueprint`));
}

export async function markLeadLost(id: string, reason?: string): Promise<SalesLead> {
  return unwrap(
    await apiClient<SalesLead>(`${CRM_LEADS_API}/${id}/lost`, { method: "POST", body: { reason } }),
  );
}

export type LeadConvertInput = {
  pipeline_id: string;
  opportunity_name: string;
  expected_revenue?: number;
  existing_customer_id?: string | null;
  create_customer?: boolean;
  remark?: string | null;
};

export async function convertLead(id: string, body: LeadConvertInput): Promise<Opportunity> {
  return unwrap(
    await apiClient<Opportunity>(`${CRM_LEADS_API}/${id}/convert`, { method: "POST", body }),
  );
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export const CRM_OPPORTUNITIES_API = "/crm/opportunities";

export type Opportunity = {
  id: string;
  company_id: string;
  branch_id: string;
  lead_id: string | null;
  company_account_id: string | null;
  opportunity_code: string;
  opportunity_name: string;
  status: string;
  current_stage: string;
  expected_revenue: number;
  probability_percent: number;
  forecast_amount: number | null;
  customer_id: string | null;
  sales_quotation_id: string | null;
  sales_order_id: string | null;
  version: number;
};

export async function listOpportunities(): Promise<Opportunity[]> {
  const res = await resourceService.list<Opportunity>(CRM_OPPORTUNITIES_API);
  return asArray(res.data);
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  return unwrap(await resourceService.get<Opportunity>(CRM_OPPORTUNITIES_API, id));
}

export async function getOpportunityBlueprint(id: string): Promise<BlueprintState> {
  return unwrap(await apiClient<BlueprintState>(`${CRM_OPPORTUNITIES_API}/${id}/blueprint`));
}

export async function applyOpportunityAction(
  id: string,
  action: string,
  payload: BlueprintActionPayload,
): Promise<{ id: string; blueprint_state: string; locked: boolean; status: string }> {
  return unwrap(
    await apiClient(`${CRM_OPPORTUNITIES_API}/${id}/actions/${action}`, {
      method: "POST",
      body: payload,
    }),
  );
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const CRM_QUOTES_API = "/crm/quotes";

export type Quote = {
  id: string;
  company_id: string;
  branch_id: string;
  opportunity_id: string;
  company_account_id: string | null;
  contact_id: string | null;
  subject: string | null;
  quote_no: string;
  quote_revision: number;
  quote_stage: string;
  approval_status: string;
  locked: boolean;
  valid_until: string | null;
  freight: number;
  grand_total: number;
  avg_margin_pct: number;
  total_margin_amount: number;
  reason_for_discount: string | null;
  sales_order_id: string | null;
  version: number;
};

export type QuoteFormInput = {
  opportunity_id: string;
  branch_id: string;
  contact_id?: string | null;
  subject?: string | null;
  valid_until?: string | null;
  entity_name?: string | null;
  entity_email?: string | null;
  entity_address?: string | null;
  entity_gst?: string | null;
  entity_contact?: string | null;
  billing_country?: string | null;
  shipping_country?: string | null;
  freight?: number;
  terms?: string | null;
  description?: string | null;
  reason_for_discount?: string | null;
};

export type QuoteLine = {
  id: string;
  quote_id: string;
  line_no: number;
  product_id: string | null;
  product_name: string;
  hsn_sac: string | null;
  line_type: string;
  qty: number;
  unit_cost: number;
  unit_sell: number;
  margin_pct: number;
  margin_amount: number;
  gst_pct: number;
  gst_amount: number;
  line_total: number;
  version: number;
};

export type QuoteLineFormInput = {
  product_id?: string | null;
  product_name: string;
  hsn_sac?: string | null;
  description?: string | null;
  line_type?: string;
  qty?: number;
  unit_cost?: number;
  unit_sell?: number;
  gst_pct?: number;
};

export type QuoteMarginSummary = {
  quote_id: string;
  avg_margin_pct: number;
  total_margin_amount: number;
  total_sell_amount: number;
  required_threshold_pct: number;
  requires_management_approval: boolean;
  line_types_present: string[];
};

export async function listQuotes(params?: { opportunity_id?: string }): Promise<Quote[]> {
  const res = await resourceService.list<Quote>(CRM_QUOTES_API, params);
  return asArray(res.data);
}

export async function getQuote(id: string): Promise<Quote> {
  return unwrap(await resourceService.get<Quote>(CRM_QUOTES_API, id));
}

export async function createQuote(body: QuoteFormInput): Promise<Quote> {
  return unwrap(await resourceService.create<Quote>(CRM_QUOTES_API, body));
}

export async function updateQuote(id: string, body: Partial<QuoteFormInput>): Promise<Quote> {
  return unwrap(await resourceService.update<Quote>(CRM_QUOTES_API, id, body));
}

export async function listQuoteLines(quoteId: string): Promise<QuoteLine[]> {
  const res = await apiClient<QuoteLine[]>(`${CRM_QUOTES_API}/${quoteId}/lines`);
  return asArray(res.data);
}

export async function addQuoteLine(quoteId: string, body: QuoteLineFormInput): Promise<QuoteLine> {
  return unwrap(
    await apiClient<QuoteLine>(`${CRM_QUOTES_API}/${quoteId}/lines`, { method: "POST", body }),
  );
}

export async function updateQuoteLine(
  lineId: string,
  body: Partial<QuoteLineFormInput>,
): Promise<QuoteLine> {
  return unwrap(
    await apiClient<QuoteLine>(`${CRM_QUOTES_API}/lines/${lineId}`, { method: "PATCH", body }),
  );
}

export async function deleteQuoteLine(lineId: string): Promise<void> {
  await apiClient(`${CRM_QUOTES_API}/lines/${lineId}`, { method: "DELETE" });
}

export async function getQuoteMargin(quoteId: string): Promise<QuoteMarginSummary> {
  return unwrap(await apiClient<QuoteMarginSummary>(`${CRM_QUOTES_API}/${quoteId}/margin`));
}

export async function getQuoteBlueprint(quoteId: string): Promise<BlueprintState> {
  return unwrap(await apiClient<BlueprintState>(`${CRM_QUOTES_API}/${quoteId}/blueprint`));
}

export async function sendQuoteForApproval(
  quoteId: string,
  body: { team_role?: string; remarks?: string | null },
): Promise<Quote> {
  return unwrap(
    await apiClient<Quote>(`${CRM_QUOTES_API}/${quoteId}/send-for-approval`, {
      method: "POST",
      body,
    }),
  );
}

export async function approveQuoteInternally(
  quoteId: string,
  body: { remark?: string | null },
): Promise<Quote> {
  return unwrap(
    await apiClient<Quote>(`${CRM_QUOTES_API}/${quoteId}/approve-internally`, {
      method: "POST",
      body,
    }),
  );
}

export async function applyQuoteAction(
  quoteId: string,
  action: string,
  payload: BlueprintActionPayload,
): Promise<Quote> {
  return unwrap(
    await apiClient<Quote>(`${CRM_QUOTES_API}/${quoteId}/actions/${action}`, {
      method: "POST",
      body: payload,
    }),
  );
}

// ---------------------------------------------------------------------------
// OVF (Order Value Form)
// ---------------------------------------------------------------------------

export const CRM_OVF_API = "/crm/ovf";

export type Ovf = {
  id: string;
  company_id: string;
  branch_id: string;
  ovf_no: string;
  quote_id: string;
  opportunity_id: string;
  company_account_id: string | null;
  po_number: string | null;
  approval_status: string;
  blueprint_state: string;
  locked: boolean;
  shared_to_scm: boolean;
  deal_won: boolean;
  deal_won_amount: number | null;
  vendor_payment_days: number;
  customer_payment_days: number;
  finance_cost_pct: number;
  total_margin_pct: number;
  total_margin_amount: number;
  version: number;
};

export type OvfFormInput = {
  quote_id: string;
  branch_id: string;
  po_number?: string | null;
  delivery_period?: string | null;
  technology_segment?: string | null;
  sub_technology_segment?: string | null;
  installation_details?: string | null;
  vendor_payment_days?: number;
  customer_payment_days?: number;
  additional_charges?: number;
  freight?: number;
};

export type OvfLine = {
  id: string;
  ovf_id: string;
  side: string;
  line_no: number;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  version: number;
};

export type OvfLineFormInput = {
  side?: string;
  product_name: string;
  qty?: number;
  unit_price?: number;
};

export async function listOvfs(params?: { opportunity_id?: string }): Promise<Ovf[]> {
  const res = await resourceService.list<Ovf>(CRM_OVF_API, params);
  return asArray(res.data);
}

export async function getOvf(id: string): Promise<Ovf> {
  return unwrap(await resourceService.get<Ovf>(CRM_OVF_API, id));
}

export async function createOvf(body: OvfFormInput): Promise<Ovf> {
  return unwrap(await resourceService.create<Ovf>(CRM_OVF_API, body));
}

export async function listOvfLines(ovfId: string): Promise<OvfLine[]> {
  const res = await apiClient<OvfLine[]>(`${CRM_OVF_API}/${ovfId}/lines`);
  return asArray(res.data);
}

export async function addOvfLine(ovfId: string, body: OvfLineFormInput): Promise<OvfLine> {
  return unwrap(
    await apiClient<OvfLine>(`${CRM_OVF_API}/${ovfId}/lines`, { method: "POST", body }),
  );
}

export async function getOvfBlueprint(id: string): Promise<BlueprintState> {
  return unwrap(await apiClient<BlueprintState>(`${CRM_OVF_API}/${id}/blueprint`));
}

export async function sendOvfForApproval(
  id: string,
  body: { team_role?: string; remarks?: string | null },
): Promise<Ovf> {
  return unwrap(
    await apiClient<Ovf>(`${CRM_OVF_API}/${id}/send-for-approval`, { method: "POST", body }),
  );
}

export async function shareOvfToScm(id: string): Promise<Ovf> {
  return unwrap(await apiClient<Ovf>(`${CRM_OVF_API}/${id}/share-to-scm`, { method: "POST", body: {} }));
}

export async function markOvfDealWon(id: string, dealWonAmount: number): Promise<Ovf> {
  return unwrap(
    await apiClient<Ovf>(`${CRM_OVF_API}/${id}/deal-won`, {
      method: "POST",
      body: { deal_won_amount: dealWonAmount },
    }),
  );
}

export async function applyOvfAction(
  id: string,
  action: string,
  payload: BlueprintActionPayload,
): Promise<Ovf> {
  return unwrap(
    await apiClient<Ovf>(`${CRM_OVF_API}/${id}/actions/${action}`, { method: "POST", body: payload }),
  );
}

// ---------------------------------------------------------------------------
// My Jobs
// ---------------------------------------------------------------------------

export const CRM_MY_JOBS_API = "/crm/my-jobs";

export type ApprovalTask = {
  id: string;
  task_code: string;
  title: string;
  entity_type: string;
  entity_id: string;
  team_role: string;
  assigned_role: string | null;
  assigned_user_id: string | null;
  status: string;
  requested_by: string | null;
  remarks: string | null;
  decision_remark: string | null;
  decided_at: string | null;
  decided_by: string | null;
  priority: string;
  due_at: string | null;
  notification_sent: boolean;
  action: string | null;
  company_id: string;
  branch_id: string;
};

export async function listMyJobs(params?: {
  team_role?: string;
  status?: string;
  mine?: boolean;
  entity_type?: string;
  entity_id?: string;
}): Promise<ApprovalTask[]> {
  const res = await resourceService.list<ApprovalTask>(CRM_MY_JOBS_API, params);
  return asArray(res.data);
}

export async function decideMyJob(
  id: string,
  decision: "approved" | "rejected",
  remark?: string,
): Promise<ApprovalTask> {
  return unwrap(
    await apiClient<ApprovalTask>(`${CRM_MY_JOBS_API}/${id}/decide`, {
      method: "POST",
      body: { decision, remark },
    }),
  );
}

/** Build the detail-page href for a My Jobs task's underlying entity. */
export function myJobEntityHref(entityType: string, entityId: string): string {
  switch (entityType) {
    case "lead":
      return `/crm/leads/${entityId}`;
    case "opportunity":
      return `/crm/opportunities/${entityId}`;
    case "quote":
      return `/crm/quotes/${entityId}`;
    case "ovf":
      return `/crm/ovf/${entityId}`;
    default:
      return "/crm/my-jobs";
  }
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const CRM_ATTACHMENTS_API = "/crm/attachments";

export type Attachment = {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_path: string;
  content_type: string | null;
  size: number | null;
  category: string;
  uploaded_by: string | null;
  company_id: string;
  branch_id: string;
};

export type AttachmentFormInput = {
  entity_type: string;
  entity_id: string;
  branch_id: string;
  company_id?: string | null;
  file_name: string;
  category?: string;
  file_path?: string | null;
  content_base64?: string | null;
  content_type?: string | null;
};

export async function listAttachments(entityType: string, entityId: string): Promise<Attachment[]> {
  const res = await resourceService.list<Attachment>(CRM_ATTACHMENTS_API, {
    entity_type: entityType,
    entity_id: entityId,
  });
  return asArray(res.data);
}

export async function createAttachment(body: AttachmentFormInput): Promise<Attachment> {
  return unwrap(await resourceService.create<Attachment>(CRM_ATTACHMENTS_API, body));
}

// ---------------------------------------------------------------------------
// Lookups shared by sales CRM forms
// ---------------------------------------------------------------------------

export type Option = { id: string; label: string };

export async function listLeadSourceOptions(): Promise<Option[]> {
  const res = await resourceService.list("/crm/lead-sources");
  const rows = asArray(res.data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.source_name ?? r.source_code ?? r.id),
  }));
}

export async function listPipelineOptions(): Promise<Option[]> {
  const res = await resourceService.list("/crm/pipelines");
  const rows = asArray(res.data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.pipeline_name ?? r.pipeline_code ?? r.id),
  }));
}

export async function listBranchOptions(): Promise<Option[]> {
  const res = await resourceService.list("/branches");
  const rows = asArray(res.data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.branch_name ?? r.name ?? r.id),
  }));
}

export async function listEmployeeOptions(): Promise<Option[]> {
  const res = await resourceService.list("/employees");
  const rows = asArray(res.data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows.map((r) => ({
    id: String(r.id),
    label: `${[r.first_name, r.last_name].filter(Boolean).join(" ")}${
      r.employee_code ? ` (${r.employee_code})` : ""
    }`.trim(),
  }));
}
