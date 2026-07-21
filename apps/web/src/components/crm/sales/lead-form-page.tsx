"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SyncedBanner } from "@/components/crm/sales/approval-banner";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createLeadFromCompany,
  getCompany,
  listEmployeeOptions,
  listLeadSourceOptions,
  type Company,
  type LeadCreateFromCompanyInput,
  type Option,
} from "@/services/sales-crm-service";

const PRODUCT_TYPES = ["hardware", "software", "others"] as const;

const EMPTY: LeadCreateFromCompanyInput = {
  branch_id: "",
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  lead_source_id: "",
  owner_employee_id: "",
  expected_amount: undefined,
  expected_closure_date: "",
  product_type: "hardware",
  sub_product_category: "",
  sub_product: "",
  sub_product_other: "",
  project_title: "",
  territory: "",
  region: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  notes: "",
};

export function LeadFormPage({ companyAccountId }: { companyAccountId: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [form, setForm] = useState<LeadCreateFromCompanyInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRow, sources, emps] = await Promise.all([
        getCompany(companyAccountId),
        listLeadSourceOptions().catch(() => []),
        listEmployeeOptions().catch(() => []),
      ]);
      setCompany(companyRow);
      setLeadSources(sources);
      setEmployees(emps);
      setForm((f) => ({
        ...f,
        branch_id: companyRow.branch_id,
        first_name: companyRow.customer_name,
        email: companyRow.customer_email ?? "",
        street: companyRow.billing_street,
        city: companyRow.billing_city,
        state: companyRow.billing_state,
        zip: companyRow.billing_code,
        country: companyRow.billing_country,
      }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof LeadCreateFromCompanyInput>(key: K, value: LeadCreateFromCompanyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    if (!form.mobile?.trim() || !form.lead_source_id || !form.owner_employee_id) {
      setError("Mobile, lead source, and owner are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await createLeadFromCompany(companyAccountId, {
        ...form,
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
      });
      router.push(`/crm/leads/${lead.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to create lead",
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
    <div className="space-y-4">
      <Link
        href={`/crm/companies/${companyAccountId}`}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary"
      >
        <ArrowLeft className="size-3.5" /> {company?.customer_name ?? "Company"}
      </Link>

      <PageHeader
        title="Create Lead"
        description="The only supported entry point for a sales-process lead is from its parent company."
      />

      {company ? <SyncedBanner from={`Company · ${company.customer_name}`} /> : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
        <FinanceField label="First Name">
          <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
        </FinanceField>
        <FinanceField label="Last Name">
          <Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
        </FinanceField>
        <FinanceField label="Mobile *">
          <Input value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
        </FinanceField>
        <FinanceField label="Email">
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </FinanceField>
        <FinanceField label="Lead Source *">
          <FinanceSelect value={form.lead_source_id} onChange={(e) => set("lead_source_id", e.target.value)}>
            <option value="">Select source</option>
            {leadSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Owner *">
          <FinanceSelect value={form.owner_employee_id} onChange={(e) => set("owner_employee_id", e.target.value)}>
            <option value="">Select owner</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Expected Amount (₹)">
          <Input
            type="number"
            min={0}
            value={form.expected_amount ?? ""}
            onChange={(e) => set("expected_amount", e.target.value ? Number(e.target.value) : undefined)}
          />
        </FinanceField>
        <FinanceField label="Expected Closure Date">
          <Input
            type="date"
            value={form.expected_closure_date ?? ""}
            onChange={(e) => set("expected_closure_date", e.target.value)}
          />
        </FinanceField>
        <FinanceField label="Project Title">
          <Input value={form.project_title ?? ""} onChange={(e) => set("project_title", e.target.value)} />
        </FinanceField>
      </section>

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
        <h2 className="text-sm font-medium tracking-tight sm:col-span-2 xl:col-span-3">Requirement</h2>
        <FinanceField label="Product Type">
          <FinanceSelect value={form.product_type ?? "hardware"} onChange={(e) => set("product_type", e.target.value)}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "others" ? "Others" : t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        {form.product_type === "others" ? (
          <FinanceField label="Other product (free text)" className="sm:col-span-2">
            <Input
              value={form.sub_product_other ?? ""}
              onChange={(e) => set("sub_product_other", e.target.value)}
              placeholder="Describe the requirement…"
            />
          </FinanceField>
        ) : (
          <>
            <FinanceField label="Sub Category">
              <Input
                value={form.sub_product_category ?? ""}
                onChange={(e) => set("sub_product_category", e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Sub Product">
              <Input value={form.sub_product ?? ""} onChange={(e) => set("sub_product", e.target.value)} />
            </FinanceField>
          </>
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
        <h2 className="text-sm font-medium tracking-tight sm:col-span-2 xl:col-span-3">Location</h2>
        <FinanceField label="Territory">
          <Input value={form.territory ?? ""} onChange={(e) => set("territory", e.target.value)} />
        </FinanceField>
        <FinanceField label="Region">
          <Input value={form.region ?? ""} onChange={(e) => set("region", e.target.value)} />
        </FinanceField>
        <FinanceField label="Street">
          <Input value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} />
        </FinanceField>
        <FinanceField label="City">
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </FinanceField>
        <FinanceField label="State">
          <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
        </FinanceField>
        <FinanceField label="Country">
          <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </FinanceField>
      </section>

      <FinanceField label="Notes">
        <FinanceTextarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </FinanceField>

      <div className="flex justify-end gap-2">
        <Link
          href={`/crm/companies/${companyAccountId}`}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
        >
          Cancel
        </Link>
        <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Creating…" : "Create Lead"}
        </Button>
      </div>
    </div>
  );
}
