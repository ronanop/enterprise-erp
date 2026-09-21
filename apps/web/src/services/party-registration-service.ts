import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

export const PARTY_REGISTRATIONS_API = "/party-registrations";

export type PartyType = "customer" | "vendor";

export type RegistrationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "converted";

export type KycDocument = {
  doc_type: string;
  file_name: string;
  storage_key?: string | null;
  uploaded_at?: string | null;
};

/** Stored verbatim from the backend evaluation engine. */
export type CreditEvaluation = {
  kind: "customer_credit" | "vendor_terms";
  reasons: string[];
  decision?: string;
  risk_band?: string;
  declared_annual_turnover?: number;
  requested_credit_limit?: number;
  requested_credit_days?: number;
  turnover_based_ceiling?: number;
  exposure_ratio_pct?: number;
  ceiling_multiple?: number;
  recommended_credit_limit?: number;
  recommended_credit_days?: number;
  funding_gap_days?: number;
  funding_carry_cost?: number;
  offered_credit_days?: number;
  customer_credit_days?: number;
  expected_monthly_spend?: number;
  leverage_days?: number;
  leverage_value?: number;
  early_payment_discount_pct?: number;
  early_payment_discount_value?: number;
  recommended_action?: string;
};

export type PartyRegistration = {
  id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  registration_code: string;
  party_type: PartyType;
  legal_name: string;
  kyc_status: "pending" | "verified" | "rejected";
  status: RegistrationStatus;
  version: number;
  is_deleted: boolean;
  kyc_documents_json: KycDocument[];
  trade_name?: string | null;
  party_subtype?: string | null;
  tax_number?: string | null;
  pan_number?: string | null;
  cin_number?: string | null;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  address_json?: Record<string, unknown> | null;
  bank_details_json?: Record<string, unknown> | null;
  kyc_verified_at?: string | null;
  declared_annual_turnover?: number | null;
  requested_credit_limit?: number | null;
  requested_credit_days?: number | null;
  expected_monthly_spend?: number | null;
  early_payment_discount_pct?: number | null;
  currency_code?: string | null;
  evaluation_json?: CreditEvaluation | null;
  assessed_credit_limit?: number | null;
  assessed_credit_days?: number | null;
  risk_band?: string | null;
  evaluated_at?: string | null;
  decision_reason?: string | null;
  decided_at?: string | null;
  customer_id?: string | null;
  vendor_id?: string | null;
};

export type PartyRegistrationCreatePayload = {
  branch_id: string;
  party_type: PartyType;
  legal_name: string;
  company_id?: string;
  trade_name?: string;
  party_subtype?: string;
  tax_number?: string;
  pan_number?: string;
  cin_number?: string;
  contact_person?: string;
  email?: string;
  mobile?: string;
  address_json?: Record<string, unknown>;
  bank_details_json?: Record<string, unknown>;
  kyc_documents_json?: KycDocument[];
  declared_annual_turnover?: number;
  requested_credit_limit?: number;
  requested_credit_days?: number;
  expected_monthly_spend?: number;
  early_payment_discount_pct?: number;
  currency_code?: string;
};

export type PartyRegistrationUpdatePayload = Partial<
  Omit<PartyRegistrationCreatePayload, "party_type">
> & { version: number };

function asRows(data: unknown): PartyRegistration[] {
  if (Array.isArray(data)) return data as PartyRegistration[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "data", "rows"]) {
      if (Array.isArray(obj[key])) return obj[key] as PartyRegistration[];
    }
  }
  return [];
}

export async function listPartyRegistrations(params: {
  party_type?: PartyType;
  status?: RegistrationStatus;
  page?: number;
  page_size?: number;
} = {}): Promise<PartyRegistration[]> {
  const res = await resourceService.list<PartyRegistration[]>(PARTY_REGISTRATIONS_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    ...(params.party_type ? { party_type: params.party_type } : {}),
    ...(params.status ? { status: params.status } : {}),
  });
  return asRows(res.data);
}

export async function getPartyRegistration(id: string): Promise<PartyRegistration> {
  const res = await resourceService.get<PartyRegistration>(PARTY_REGISTRATIONS_API, id);
  if (!res.data) throw new ApiClientError("Registration not found", 404);
  return res.data;
}

export async function createPartyRegistration(
  payload: PartyRegistrationCreatePayload,
): Promise<PartyRegistration> {
  const res = await resourceService.create<PartyRegistration>(
    PARTY_REGISTRATIONS_API,
    payload,
  );
  if (!res.data) throw new ApiClientError("Failed to create registration", 500);
  return res.data;
}

export async function updatePartyRegistration(
  id: string,
  payload: PartyRegistrationUpdatePayload,
): Promise<PartyRegistration> {
  const res = await apiClient<PartyRegistration>(`${PARTY_REGISTRATIONS_API}/${id}`, {
    method: "PUT",
    body: payload,
  });
  if (!res.data) throw new ApiClientError("Failed to update registration", 500);
  return res.data;
}

async function action(
  id: string,
  name: string,
  body?: unknown,
): Promise<PartyRegistration> {
  const res = await resourceService.action<PartyRegistration>(
    PARTY_REGISTRATIONS_API,
    id,
    name,
    body,
  );
  if (!res.data) throw new ApiClientError(`Failed to ${name} registration`, 500);
  return res.data;
}

export function verifyKyc(id: string, verified: boolean, reason?: string) {
  return action(id, "verify-kyc", { verified, reason: reason || null });
}

export function evaluateCredit(
  id: string,
  opts: {
    supplier_credit_days?: number;
    customer_credit_days?: number;
    monthly_interest_rate_pct?: number;
  } = {},
) {
  return action(id, "evaluate", {
    supplier_credit_days: opts.supplier_credit_days ?? 60,
    customer_credit_days: opts.customer_credit_days ?? 30,
    monthly_interest_rate_pct: opts.monthly_interest_rate_pct ?? null,
  });
}

export function submitRegistration(id: string) {
  return action(id, "submit");
}

export function approveRegistration(
  id: string,
  body: {
    approved_credit_limit?: number | null;
    approved_credit_days?: number | null;
    reason?: string;
    override_risk_band?: boolean;
  },
) {
  return action(id, "approve", body);
}

export function rejectRegistration(id: string, reason: string) {
  return action(id, "reject", { reason });
}

export function deleteRegistration(id: string) {
  return resourceService.delete(PARTY_REGISTRATIONS_API, id);
}
