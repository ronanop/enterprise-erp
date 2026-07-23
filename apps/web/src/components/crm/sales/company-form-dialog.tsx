"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createCompany,
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
const ACCOUNT_TYPES = ["prospect", "customer", "partner", "vendor"];
const CONTACT_ROLES = ["User", "Decision Maker", "Influencer", "Technical Evaluator", "Procurement", "Finance"];

const EMPTY_FORM: CompanyFormInput = {
  branch_id: "",
  customer_name: "",
  account_owner_id: "",
  account_type: "",
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

type Props = {
  open: boolean;
  company?: Company | null;
  onClose: () => void;
  onSaved: (company: Company) => void;
};

export function CompanyFormDialog({ open, company, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CompanyFormInput>(EMPTY_FORM);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.all([listBranchOptions(), listEmployeeOptions()]).then(([b, e]) => {
      setEmployees(e);
      if (!company && b[0]) {
        setForm((current) => ({
          ...current,
          branch_id: current.branch_id || b[0].id,
        }));
      }
    });
  }, [open, company]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (company) {
      setForm({
        branch_id: company.branch_id,
        customer_name: company.customer_name,
        account_owner_id: company.account_owner_id ?? "",
        account_type: company.account_type ?? "",
        industry: company.industry,
        other_industries: company.other_industries ?? "",
        portal_id: company.portal_id ?? "",
        source: company.source,
        rating: company.rating ?? "",
        first_name: company.first_name ?? "",
        last_name: company.last_name ?? "",
        customer_email: company.customer_email ?? "",
        phone: company.phone ?? "",
        website: company.website ?? "",
        account_ownership_id: company.account_ownership_id ?? "",
        customer_id_ext: company.customer_id_ext ?? "",
        role: company.role ?? "User",
        billing_street: company.billing_street,
        billing_city: company.billing_city,
        billing_state: company.billing_state,
        billing_code: company.billing_code,
        billing_country: company.billing_country,
        shipping_street: company.shipping_street ?? "",
        shipping_city: company.shipping_city ?? "",
        shipping_state: company.shipping_state ?? "",
        shipping_code: company.shipping_code ?? "",
        shipping_country: company.shipping_country ?? "",
        description: company.description ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, company]);

  if (!open) return null;

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
    if (!form.customer_name.trim() || !form.industry || !form.source) {
      setError("Customer name, industry, and source are required.");
      return;
    }
    if (!form.account_type) {
      setError("Account type is required.");
      return;
    }
    if (!form.first_name?.trim()) {
      setError("First name is required.");
      return;
    }
    if (!form.last_name?.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!form.customer_email?.trim()) {
      setError("Customer email is required.");
      return;
    }
    if (!form.phone?.trim()) {
      setError("Phone is required.");
      return;
    }
    if (!company && !form.branch_id) {
      setError("Branch is required.");
      return;
    }
    if (
      !form.billing_street.trim() ||
      !form.billing_city.trim() ||
      !form.billing_state.trim() ||
      !form.billing_code.trim() ||
      !form.billing_country.trim()
    ) {
      setError("Billing address is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CompanyFormInput = {
        ...form,
        account_owner_id: form.account_owner_id || null,
        account_ownership_id: form.account_ownership_id || null,
      };
      const saved = company
        ? await updateCompany(company.id, payload)
        : await createCompany(payload);
      onSaved(saved);
      onClose();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="erp-scroll max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border/80 bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium tracking-tight">
          {company ? `Edit ${company.customer_name}` : "New Company"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sales accounts are the entry point for the sales blueprint — leads can only be created
          from a company.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          <section className="rounded-lg border border-border/70 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
              Account Information
            </h3>
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
                    value={form.account_type ?? ""}
                    onChange={(e) => set("account_type", e.target.value)}
                  >
                    <option value="">None</option>
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
                  <FinanceSelect value={form.source} onChange={(e) => set("source", e.target.value)}>
                    <option value="">None</option>
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source.replaceAll("_", " ")}
                      </option>
                    ))}
                  </FinanceSelect>
                </FinanceField>
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
          </section>

          <section className="rounded-lg border border-border/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold tracking-wide text-foreground">
                Address Information
              </h3>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="cursor-pointer"
                onClick={copyBillingToShipping}
              >
                <Copy className="size-3" /> Copy Address
              </Button>
            </div>
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
          </section>

          <section className="rounded-lg border border-border/70 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
              Description Information
            </h3>
            <FinanceField label="Description">
              <FinanceTextarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </FinanceField>
          </section>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" className="cursor-pointer" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : company ? "Save changes" : "Create Company"}
          </Button>
        </div>
      </div>
    </div>
  );
}
