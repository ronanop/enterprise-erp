"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Copy, FileText, MapPin } from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createCompany,
  getCompany,
  listBranchOptions,
  listEmployeeOptions,
  updateCompany,
  type Company,
  type CompanyFormInput,
  type Option,
} from "@/services/sales-crm-service";

const INDUSTRIES = [
  "IT & Technology",
  "Manufacturing",
  "Healthcare",
  "BFSI",
  "Retail",
  "Government",
  "Education",
  "Telecom",
  "Others",
];
const SOURCES = ["referral", "website", "cold_call", "partner", "event", "advertisement", "other"];
const RATINGS = ["hot", "warm", "cold"];
const ACCOUNT_TYPES = ["customer"] as const;
const CONTACT_ROLES = ["User", "Decision Maker", "Influencer", "Technical Evaluator", "Procurement", "Finance"];

const EMPTY_FORM: CompanyFormInput = {
  branch_id: "",
  customer_name: "",
  account_owner_id: "",
  account_type: "customer",
  industry: "",
  other_industries: "",
  portal_id: "",
  source: "",
  rating: "",
  first_name: "",
  last_name: "",
  customer_email: "",
  phone: "",
  website: "",
  account_ownership_id: "",
  customer_id_ext: "",
  role: "User",
  billing_street: "",
  billing_city: "",
  billing_state: "",
  billing_code: "",
  billing_country: "India",
  shipping_street: "",
  shipping_city: "",
  shipping_state: "",
  shipping_code: "",
  shipping_country: "",
  description: "",
};

export function CompanyFormPage({ companyId }: { companyId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(companyId);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormInput>(EMPTY_FORM);
  const [otherSource, setOtherSource] = useState("");
  const [employees, setEmployees] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

  const backHref = isEdit && companyId ? `/crm/companies/${companyId}` : "/crm/companies";
  const backLabel = isEdit ? (company?.customer_name ?? "Company") : "Companies";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branches, emps, companyRow] = await Promise.all([
        listBranchOptions(),
        listEmployeeOptions(),
        companyId ? getCompany(companyId) : Promise.resolve(null),
      ]);
      setEmployees(emps);
      if (companyRow) {
        const knownSource = SOURCES.includes(companyRow.source);
        setCompany(companyRow);
        setForm({
          branch_id: companyRow.branch_id,
          customer_name: companyRow.customer_name,
          account_owner_id: companyRow.account_owner_id ?? "",
          account_type: companyRow.account_type || "customer",
          industry: companyRow.industry,
          other_industries: companyRow.other_industries ?? "",
          portal_id: companyRow.portal_id ?? "",
          source: knownSource ? companyRow.source : "other",
          rating: companyRow.rating ?? "",
          first_name: companyRow.first_name ?? "",
          last_name: companyRow.last_name ?? "",
          customer_email: companyRow.customer_email ?? "",
          phone: companyRow.phone ?? "",
          website: companyRow.website ?? "",
          account_ownership_id: companyRow.account_ownership_id ?? "",
          customer_id_ext: companyRow.customer_id_ext ?? "",
          role: companyRow.role ?? "User",
          billing_street: companyRow.billing_street,
          billing_city: companyRow.billing_city,
          billing_state: companyRow.billing_state,
          billing_code: companyRow.billing_code,
          billing_country: companyRow.billing_country,
          shipping_street: companyRow.shipping_street ?? "",
          shipping_city: companyRow.shipping_city ?? "",
          shipping_state: companyRow.shipping_state ?? "",
          shipping_code: companyRow.shipping_code ?? "",
          shipping_country: companyRow.shipping_country ?? "",
          description: companyRow.description ?? "",
        });
        setOtherSource(knownSource ? "" : companyRow.source);
      } else {
        setCompany(null);
        setForm({
          ...EMPTY_FORM,
          branch_id: branches[0]?.id ?? "",
        });
        setOtherSource("");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company form");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof CompanyFormInput>(key: K, value: CompanyFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function copyBillingToShipping() {
    setForm((f) => ({
      ...f,
      shipping_street: f.billing_street,
      shipping_city: f.billing_city,
      shipping_state: f.billing_state,
      shipping_code: f.billing_code,
      shipping_country: f.billing_country,
    }));
  }

  async function save() {
    const missing: string[] = [];
    if (!form.customer_name.trim()) missing.push("Customer Name");
    if (!form.account_type) missing.push("Account Type");
    if (!form.industry) missing.push("Industry");
    if (!form.source) missing.push("Source");
    if (form.source === "other" && !otherSource.trim()) missing.push("Other Source");
    if (!form.first_name?.trim()) missing.push("First Name");
    if (!form.last_name?.trim()) missing.push("Last Name");
    if (!form.customer_email?.trim()) missing.push("Customer Email");
    if (!form.phone?.trim()) missing.push("Phone");
    if (!isEdit && !form.branch_id) missing.push("Branch");
    if (!form.billing_street.trim()) missing.push("Billing Street");
    if (!form.billing_city.trim()) missing.push("Billing City");
    if (!form.billing_state.trim()) missing.push("Billing State");
    if (!form.billing_code.trim()) missing.push("Billing Code");
    if (!form.billing_country.trim()) missing.push("Billing Country");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CompanyFormInput = {
        ...form,
        source: form.source === "other" ? otherSource.trim() : form.source,
        account_owner_id: form.account_owner_id || null,
        account_ownership_id: form.account_ownership_id || null,
      };
      const saved = isEdit && companyId
        ? await updateCompany(companyId, payload)
        : await createCompany(payload);
      router.push(`/crm/companies/${saved.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save company",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <CrmPage>
      <Link
        href={backHref}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> {backLabel}
      </Link>

      <PageHeader
        title={isEdit ? `Edit ${company?.customer_name ?? "Company"}` : "New Company"}
        description="Sales accounts are the entry point for the sales blueprint — leads can only be created from a company."
      />

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="Account Information" icon={Building2}>
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
            <div className="space-y-3">
              <FinanceField label="Account Owner">
                <FinanceSelect
                  value={form.account_owner_id ?? ""}
                  onChange={(e) => set("account_owner_id", e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.label}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="Customer Name *">
                <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </FinanceField>
              <FinanceField label="Account Number">
                <Input
                  value={company?.account_number ?? ""}
                  disabled
                  aria-readonly="true"
                />
              </FinanceField>
              <FinanceField label="Account Type *">
                <FinanceSelect
                  value={form.account_type || "customer"}
                  onChange={(e) => set("account_type", e.target.value)}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="Industry *">
                <FinanceSelect value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                  <option value="">None</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="Other Industries">
                <Input
                  value={form.other_industries ?? ""}
                  onChange={(e) => set("other_industries", e.target.value)}
                />
              </FinanceField>
              <FinanceField label="Portal ID">
                <Input value={form.portal_id ?? ""} onChange={(e) => set("portal_id", e.target.value)} />
              </FinanceField>
              <FinanceField label="Source *">
                <FinanceSelect
                  value={form.source}
                  onChange={(e) => {
                    const value = e.target.value;
                    set("source", value);
                    if (value !== "other") setOtherSource("");
                  }}
                >
                  <option value="">None</option>
                  {SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source.replaceAll("_", " ")}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              {form.source === "other" ? (
                <FinanceField label="Other Source *">
                  <Input
                    value={otherSource}
                    onChange={(e) => setOtherSource(e.target.value)}
                    placeholder="Enter source"
                  />
                </FinanceField>
              ) : null}
            </div>

            <div className="space-y-3">
              <FinanceField label="Rating">
                <FinanceSelect value={form.rating ?? ""} onChange={(e) => set("rating", e.target.value)}>
                  <option value="">None</option>
                  {RATINGS.map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="First Name *">
                <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
              </FinanceField>
              <FinanceField label="Last Name *">
                <Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
              </FinanceField>
              <FinanceField label="Customer Email *">
                <Input
                  type="email"
                  value={form.customer_email ?? ""}
                  onChange={(e) => set("customer_email", e.target.value)}
                />
              </FinanceField>
              <FinanceField label="Phone *">
                <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </FinanceField>
              <FinanceField label="Website">
                <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
              </FinanceField>
              <FinanceField label="Account Ownership">
                <FinanceSelect
                  value={form.account_ownership_id ?? ""}
                  onChange={(e) => set("account_ownership_id", e.target.value)}
                >
                  <option value="">None</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.label}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="Customer ID">
                <Input
                  value={form.customer_id_ext ?? ""}
                  onChange={(e) => set("customer_id_ext", e.target.value)}
                />
              </FinanceField>
              <FinanceField label="Role">
                <FinanceSelect value={form.role ?? ""} onChange={(e) => set("role", e.target.value)}>
                  <option value="">None</option>
                  {CONTACT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
            </div>
          </div>
      </CrmSection>

      <CrmSection
        title="Address Information"
        icon={MapPin}
        actions={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={copyBillingToShipping}
          >
            <Copy className="size-3" /> Copy Address
          </Button>
        }
      >
          <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
            <FinanceField label="Billing Street *">
              <Input value={form.billing_street} onChange={(e) => set("billing_street", e.target.value)} />
            </FinanceField>
            <FinanceField label="Shipping Street">
              <Input
                value={form.shipping_street ?? ""}
                onChange={(e) => set("shipping_street", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Billing City *">
              <Input value={form.billing_city} onChange={(e) => set("billing_city", e.target.value)} />
            </FinanceField>
            <FinanceField label="Shipping City">
              <Input
                value={form.shipping_city ?? ""}
                onChange={(e) => set("shipping_city", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Billing State *">
              <Input value={form.billing_state} onChange={(e) => set("billing_state", e.target.value)} />
            </FinanceField>
            <FinanceField label="Shipping State">
              <Input
                value={form.shipping_state ?? ""}
                onChange={(e) => set("shipping_state", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Billing Code *">
              <Input value={form.billing_code} onChange={(e) => set("billing_code", e.target.value)} />
            </FinanceField>
            <FinanceField label="Shipping Code">
              <Input
                value={form.shipping_code ?? ""}
                onChange={(e) => set("shipping_code", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Billing Country *">
              <Input
                value={form.billing_country}
                onChange={(e) => set("billing_country", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Shipping Country">
              <Input
                value={form.shipping_country ?? ""}
                onChange={(e) => set("shipping_country", e.target.value)}
              />
            </FinanceField>
          </div>
      </CrmSection>

      <CrmSection title="Description Information" icon={FileText}>
          <FinanceField label="Description">
            <FinanceTextarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </FinanceField>
      </CrmSection>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push(backHref)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" className="cursor-pointer" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create Company"}
        </Button>
      </div>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
