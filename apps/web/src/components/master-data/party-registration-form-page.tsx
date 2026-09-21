"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  listBranchOptions,
  listCompanyOptions,
  type OrgBranchOption,
  type OrgCompanyOption,
} from "@/services/organization-departments-service";
import {
  createPartyRegistration,
  getPartyRegistration,
  updatePartyRegistration,
  type KycDocument,
  type PartyType,
} from "@/services/party-registration-service";

const SUBTYPES: Record<PartyType, { value: string; label: string }[]> = {
  customer: [
    { value: "corporate", label: "Corporate" },
    { value: "individual", label: "Individual" },
    { value: "government", label: "Government" },
  ],
  vendor: [
    { value: "domestic", label: "Domestic" },
    { value: "international", label: "International" },
    { value: "service", label: "Service" },
  ],
};

const KYC_DOC_TYPES = [
  "gst_certificate",
  "pan_card",
  "incorporation_certificate",
  "cancelled_cheque",
  "audited_financials",
  "msme_certificate",
  "other",
];

type FormState = {
  company_id: string;
  branch_id: string;
  legal_name: string;
  trade_name: string;
  party_subtype: string;
  tax_number: string;
  pan_number: string;
  cin_number: string;
  contact_person: string;
  email: string;
  mobile: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  currency_code: string;
  declared_annual_turnover: string;
  requested_credit_limit: string;
  requested_credit_days: string;
  expected_monthly_spend: string;
  early_payment_discount_pct: string;
};

const EMPTY: FormState = {
  company_id: "",
  branch_id: "",
  legal_name: "",
  trade_name: "",
  party_subtype: "",
  tax_number: "",
  pan_number: "",
  cin_number: "",
  contact_person: "",
  email: "",
  mobile: "",
  line1: "",
  city: "",
  state: "",
  postal_code: "",
  currency_code: "INR",
  declared_annual_turnover: "",
  requested_credit_limit: "",
  requested_credit_days: "",
  expected_monthly_spend: "",
  early_payment_discount_pct: "",
};

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PartyRegistrationFormPage({
  partyType,
  basePath,
  registrationId,
}: {
  partyType: PartyType;
  basePath: string;
  registrationId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(registrationId);

  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    party_subtype: SUBTYPES[partyType][0].value,
  });
  const [docs, setDocs] = useState<KycDocument[]>([]);
  const [version, setVersion] = useState(1);
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [branches, setBranches] = useState<OrgBranchOption[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setCompanies(await listCompanyOptions());
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setBranches(await listBranchOptions(form.company_id || undefined));
    })();
  }, [form.company_id]);

  useEffect(() => {
    if (!registrationId) return;
    void (async () => {
      setLoading(true);
      try {
        const row = await getPartyRegistration(registrationId);
        const address = (row.address_json ?? {}) as Record<string, string>;
        setForm({
          company_id: row.company_id,
          branch_id: row.branch_id,
          legal_name: row.legal_name,
          trade_name: row.trade_name ?? "",
          party_subtype: row.party_subtype ?? SUBTYPES[partyType][0].value,
          tax_number: row.tax_number ?? "",
          pan_number: row.pan_number ?? "",
          cin_number: row.cin_number ?? "",
          contact_person: row.contact_person ?? "",
          email: row.email ?? "",
          mobile: row.mobile ?? "",
          line1: address.line1 ?? "",
          city: address.city ?? "",
          state: address.state ?? "",
          postal_code: address.postal_code ?? "",
          currency_code: row.currency_code ?? "INR",
          declared_annual_turnover: row.declared_annual_turnover?.toString() ?? "",
          requested_credit_limit: row.requested_credit_limit?.toString() ?? "",
          requested_credit_days: row.requested_credit_days?.toString() ?? "",
          expected_monthly_spend: row.expected_monthly_spend?.toString() ?? "",
          early_payment_discount_pct: row.early_payment_discount_pct?.toString() ?? "",
        });
        setDocs(row.kyc_documents_json ?? []);
        setVersion(row.version);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Unable to load registration");
      } finally {
        setLoading(false);
      }
    })();
  }, [registrationId, partyType]);

  const branchOptions = useMemo(
    () =>
      form.company_id
        ? branches.filter((b) => b.company_id === form.company_id)
        : branches,
    [branches, form.company_id],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canSave = form.legal_name.trim().length > 0 && form.branch_id.length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const address = {
      line1: form.line1 || "TBD",
      city: form.city || "TBD",
      state: form.state || undefined,
      postal_code: form.postal_code || undefined,
      country_code: "IN",
    };

    const shared = {
      legal_name: form.legal_name.trim(),
      trade_name: form.trade_name.trim() || undefined,
      party_subtype: form.party_subtype,
      tax_number: form.tax_number.trim() || undefined,
      pan_number: form.pan_number.trim() || undefined,
      cin_number: form.cin_number.trim() || undefined,
      contact_person: form.contact_person.trim() || undefined,
      email: form.email.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      address_json: address,
      kyc_documents_json: docs,
      currency_code: form.currency_code || undefined,
      declared_annual_turnover: toNumber(form.declared_annual_turnover),
      requested_credit_limit: toNumber(form.requested_credit_limit),
      requested_credit_days: toNumber(form.requested_credit_days),
      expected_monthly_spend: toNumber(form.expected_monthly_spend),
      early_payment_discount_pct: toNumber(form.early_payment_discount_pct),
    };

    try {
      if (isEdit && registrationId) {
        await updatePartyRegistration(registrationId, { ...shared, version });
        router.push(`${basePath}/${registrationId}`);
      } else {
        const created = await createPartyRegistration({
          ...shared,
          party_type: partyType,
          branch_id: form.branch_id,
          company_id: form.company_id || undefined,
        });
        router.push(`${basePath}/${created.id}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save registration",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="px-1 py-12 text-sm text-muted-foreground">Loading registration…</p>;
  }

  const isCustomer = partyType === "customer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isEdit
            ? "Edit registration"
            : isCustomer
              ? "New Customer Registration"
              : "New Vendor Registration"
        }
        description={
          isCustomer
            ? "Capture identity, KYC and the credit terms the customer is asking for."
            : "Capture identity, KYC and the payment terms the vendor is offering."
        }
        backHref={basePath}
        backLabel="Registrations"
        actions={
          <Button
            className="cursor-pointer transition-colors duration-200"
            disabled={saving || !canSave}
            onClick={() => void save()}
          >
            <Save className="size-3.5" aria-hidden />
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinanceField label="Company">
            <FinanceSelect
              value={form.company_id}
              onChange={(e) => {
                set("company_id", e.target.value);
                set("branch_id", "");
              }}
              disabled={isEdit}
            >
              <option value="">Use my default company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Branch *">
            <FinanceSelect
              value={form.branch_id}
              onChange={(e) => set("branch_id", e.target.value)}
              disabled={isEdit}
            >
              <option value="">Select a branch</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Legal name *">
            <Input
              value={form.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Trade name">
            <Input
              value={form.trade_name}
              onChange={(e) => set("trade_name", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label={isCustomer ? "Customer type" : "Vendor type"}>
            <FinanceSelect
              value={form.party_subtype}
              onChange={(e) => set("party_subtype", e.target.value)}
            >
              {SUBTYPES[partyType].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="GST number">
            <Input
              value={form.tax_number}
              onChange={(e) => set("tax_number", e.target.value)}
              className="h-8 font-mono"
            />
          </FinanceField>
          <FinanceField label="PAN">
            <Input
              value={form.pan_number}
              onChange={(e) => set("pan_number", e.target.value)}
              className="h-8 font-mono"
            />
          </FinanceField>
          <FinanceField label="CIN">
            <Input
              value={form.cin_number}
              onChange={(e) => set("cin_number", e.target.value)}
              className="h-8 font-mono"
            />
          </FinanceField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Contact and address</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinanceField label="Contact person">
            <Input
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Mobile">
            <Input
              value={form.mobile}
              onChange={(e) => set("mobile", e.target.value)}
              className="h-8 font-mono"
            />
          </FinanceField>
          <FinanceField label="Currency">
            <Input
              value={form.currency_code}
              maxLength={3}
              onChange={(e) => set("currency_code", e.target.value.toUpperCase())}
              className="h-8 font-mono"
            />
          </FinanceField>
          <FinanceField label="Address line" className="lg:col-span-2">
            <Input
              value={form.line1}
              onChange={(e) => set("line1", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="City">
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="State">
            <Input
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              className="h-8"
            />
          </FinanceField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">
          {isCustomer ? "Credit request" : "Payment terms offered"}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isCustomer ? (
            <>
              <FinanceField
                label="Declared annual turnover"
                hint="The credit ceiling is derived from this."
              >
                <Input
                  value={form.declared_annual_turnover}
                  inputMode="decimal"
                  onChange={(e) => set("declared_annual_turnover", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
              <FinanceField label="Requested credit limit">
                <Input
                  value={form.requested_credit_limit}
                  inputMode="decimal"
                  onChange={(e) => set("requested_credit_limit", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
              <FinanceField label="Requested credit days">
                <Input
                  value={form.requested_credit_days}
                  inputMode="numeric"
                  onChange={(e) => set("requested_credit_days", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
            </>
          ) : (
            <>
              <FinanceField label="Credit days offered">
                <Input
                  value={form.requested_credit_days}
                  inputMode="numeric"
                  onChange={(e) => set("requested_credit_days", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
              <FinanceField label="Expected monthly spend">
                <Input
                  value={form.expected_monthly_spend}
                  inputMode="decimal"
                  onChange={(e) => set("expected_monthly_spend", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
              <FinanceField
                label="Early payment discount %"
                hint="Discount offered for paying ahead of terms."
              >
                <Input
                  value={form.early_payment_discount_pct}
                  inputMode="decimal"
                  onChange={(e) => set("early_payment_discount_pct", e.target.value)}
                  className="h-8 font-mono"
                />
              </FinanceField>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">KYC documents</h2>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() =>
              setDocs((prev) => [...prev, { doc_type: KYC_DOC_TYPES[0], file_name: "" }])
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add document
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            At least one document is required before KYC can be verified.
          </p>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc, index) => (
              <li key={index} className="flex flex-wrap items-end gap-3">
                <FinanceField label="Document type" className="min-w-[12rem] flex-1">
                  <FinanceSelect
                    value={doc.doc_type}
                    onChange={(e) =>
                      setDocs((prev) =>
                        prev.map((d, i) =>
                          i === index ? { ...d, doc_type: e.target.value } : d,
                        ),
                      )
                    }
                  >
                    {KYC_DOC_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </FinanceSelect>
                </FinanceField>
                <FinanceField label="File name / reference" className="min-w-[14rem] flex-[2]">
                  <Input
                    value={doc.file_name}
                    onChange={(e) =>
                      setDocs((prev) =>
                        prev.map((d, i) =>
                          i === index ? { ...d, file_name: e.target.value } : d,
                        ),
                      )
                    }
                    className="h-8"
                  />
                </FinanceField>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Remove document"
                  className="h-8 cursor-pointer transition-colors duration-200"
                  onClick={() => setDocs((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
