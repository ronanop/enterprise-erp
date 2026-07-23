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

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr."] as const;
const PRODUCT_TYPES = ["hardware", "software", "services", "others"] as const;
const ENGAGEMENT_SCORES = [25, 50, 75, 100] as const;
const REQUIREMENT_TYPES = ["New Requirement", "Renewal", "Upgrade", "Replacement", "Expansion", "Support"];
const PURCHASE_MODELS = ["Direct", "Back to Back", "Stock and Sell", "Subscription", "Rental"];
const DEAL_TYPES = ["Back to Back", "Direct", "Channel", "Tender", "Renewal"];
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

const EMPTY: LeadCreateFromCompanyInput = {
  branch_id: "",
  salutation: "",
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  lead_source_id: "",
  owner_employee_id: "",
  assign_to_id: "",
  assigned_date: "",
  expected_amount: undefined,
  expected_closure_date: "",
  product_type: "",
  sub_product_category: "",
  sub_product: "",
  sub_product_other: "",
  engagement_score: undefined,
  portal_link: "",
  project_title: "",
  requirement_type: "",
  purchase_model: "",
  dr_number: "",
  new_dr_number: "",
  deal_type: "",
  industry: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  oem_name: "",
  oem_contact_person: "",
  oem_contact_number: "",
  oem_contact_email: "",
  distributor_name: "",
  distributor_contact: "",
  distributor_contact_person: "",
  distributor_contact_email: "",
  distributor_department: "",
  end_customer_name: "",
  entity_name: "",
  entity_email: "",
  entity_address: "",
  entity_gst: "",
  entity_contact: "",
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
      const sourceLabel = companyRow.source.replaceAll("_", " ").toLowerCase();
      const inheritedSource = sources.find(
        (source) => source.label.trim().toLowerCase() === sourceLabel,
      );
      const billingAddress = [
        companyRow.billing_street,
        companyRow.billing_city,
        companyRow.billing_state,
        companyRow.billing_code,
        companyRow.billing_country,
      ]
        .filter(Boolean)
        .join(", ");
      setForm((f) => ({
        ...f,
        branch_id: companyRow.branch_id,
        first_name: companyRow.first_name ?? "",
        last_name: companyRow.last_name ?? "",
        mobile: companyRow.phone ?? "",
        email: companyRow.customer_email ?? "",
        lead_source_id: f.lead_source_id || inheritedSource?.id || "",
        industry: companyRow.industry,
        portal_link: f.portal_link || companyRow.website || "",
        owner_employee_id:
          f.owner_employee_id ||
          companyRow.account_owner_id ||
          companyRow.account_ownership_id ||
          emps[0]?.id ||
          "",
        assign_to_id:
          f.assign_to_id || companyRow.account_ownership_id || companyRow.account_owner_id || "",
        assigned_date: f.assigned_date || new Date().toISOString().slice(0, 10),
        street: companyRow.billing_street,
        city: companyRow.billing_city,
        state: companyRow.billing_state,
        zip: companyRow.billing_code,
        country: companyRow.billing_country,
        end_customer_name: f.end_customer_name || companyRow.customer_name,
        entity_name: f.entity_name || companyRow.customer_name,
        entity_email: f.entity_email || companyRow.customer_email || "",
        entity_address: f.entity_address || billingAddress,
        entity_contact: f.entity_contact || companyRow.phone || "",
        notes: f.notes || companyRow.description || "",
      }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function set<K extends keyof LeadCreateFromCompanyInput>(key: K, value: LeadCreateFromCompanyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    if (
      !form.project_title?.trim() ||
      !form.email?.trim() ||
      !form.first_name?.trim() ||
      !form.last_name?.trim() ||
      !form.product_type ||
      !form.mobile?.trim() ||
      !form.lead_source_id ||
      !form.requirement_type ||
      !form.purchase_model ||
      !form.owner_employee_id
    ) {
      setError("Complete all fields marked with * before creating the lead.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await createLeadFromCompany(companyAccountId, {
        ...form,
        assign_to_id: form.assign_to_id || null,
        assigned_date: form.assigned_date || null,
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
        expected_closure_date: form.expected_closure_date || null,
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

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Lead Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Company">
            <Input value={company?.customer_name ?? ""} disabled aria-readonly="true" />
          </FinanceField>
          <FinanceField label="Customer's Project Title *">
            <Input value={form.project_title ?? ""} onChange={(e) => set("project_title", e.target.value)} />
          </FinanceField>

          <FinanceField label="Email *">
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </FinanceField>
          <FinanceField label="Lead Source *">
            <FinanceSelect value={form.lead_source_id} onChange={(e) => set("lead_source_id", e.target.value)}>
              <option value="">None</option>
              {leadSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="First Name *">
            <div className="flex gap-2">
              <FinanceSelect
                value={form.salutation ?? ""}
                onChange={(e) => set("salutation", e.target.value)}
                className="w-24 shrink-0"
              >
                <option value="">None</option>
                {SALUTATIONS.map((salutation) => (
                  <option key={salutation} value={salutation}>
                    {salutation}
                  </option>
                ))}
              </FinanceSelect>
              <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
            </div>
          </FinanceField>
          <FinanceField label="Last Name *">
            <Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
          </FinanceField>

          <FinanceField label="Product Type *">
            <FinanceSelect value={form.product_type ?? ""} onChange={(e) => set("product_type", e.target.value)}>
              <option value="">None</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Mobile *">
            <Input
              inputMode="tel"
              placeholder="Enter 10 digit phone number"
              value={form.mobile ?? ""}
              onChange={(e) => set("mobile", e.target.value)}
            />
          </FinanceField>

          <FinanceField label="Sub Product Category">
            <Input
              value={form.sub_product_category ?? ""}
              onChange={(e) => set("sub_product_category", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Requirement Type *">
            <FinanceSelect
              value={form.requirement_type ?? ""}
              onChange={(e) => set("requirement_type", e.target.value)}
            >
              <option value="">None</option>
              {REQUIREMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="Sub Product">
            <Input value={form.sub_product ?? ""} onChange={(e) => set("sub_product", e.target.value)} />
          </FinanceField>
          <FinanceField label="Purchase Model *">
            <FinanceSelect
              value={form.purchase_model ?? ""}
              onChange={(e) => set("purchase_model", e.target.value)}
            >
              <option value="">None</option>
              {PURCHASE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="Engagement Score">
            <FinanceSelect
              value={form.engagement_score ?? ""}
              onChange={(e) => set("engagement_score", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">None</option>
              {ENGAGEMENT_SCORES.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="DR Number">
            <Input value={form.dr_number ?? ""} onChange={(e) => set("dr_number", e.target.value)} />
          </FinanceField>

          <FinanceField label="Portal Link">
            <Input value={form.portal_link ?? ""} onChange={(e) => set("portal_link", e.target.value)} />
          </FinanceField>
          <FinanceField label="New DR Number">
            <Input value={form.new_dr_number ?? ""} onChange={(e) => set("new_dr_number", e.target.value)} />
          </FinanceField>

          <FinanceField label="Assign To">
            <FinanceSelect value={form.assign_to_id ?? ""} onChange={(e) => set("assign_to_id", e.target.value)}>
              <option value="">None</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Type">
            <FinanceSelect value={form.deal_type ?? ""} onChange={(e) => set("deal_type", e.target.value)}>
              <option value="">None</option>
              {DEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="Assigned Date">
            <Input
              type="date"
              value={form.assigned_date ?? ""}
              onChange={(e) => set("assigned_date", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Lead Owner *">
            <FinanceSelect
              value={form.owner_employee_id}
              onChange={(e) => set("owner_employee_id", e.target.value)}
            >
              <option value="">None</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="Expected Business Amount">
            <Input
              type="number"
              min={0}
              value={form.expected_amount ?? ""}
              onChange={(e) => set("expected_amount", e.target.value ? Number(e.target.value) : undefined)}
            />
          </FinanceField>
          <FinanceField label="Lead Status">
            <Input value="New" disabled aria-readonly="true" />
          </FinanceField>

          <FinanceField label="Expected Closure Date">
            <Input
              type="date"
              value={form.expected_closure_date ?? ""}
              onChange={(e) => set("expected_closure_date", e.target.value)}
            />
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Customer Address Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Street">
            <Input value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} />
          </FinanceField>
          <FinanceField label="City">
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </FinanceField>
          <FinanceField label="State">
            <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
          </FinanceField>
          <FinanceField label="Zip Code">
            <Input value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} />
          </FinanceField>
          <FinanceField label="Country">
            <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">OEM Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="OEM Name">
            <Input value={form.oem_name ?? ""} onChange={(e) => set("oem_name", e.target.value)} />
          </FinanceField>
          <FinanceField label="OEM Contact Person">
            <Input
              value={form.oem_contact_person ?? ""}
              onChange={(e) => set("oem_contact_person", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Number">
            <Input
              value={form.oem_contact_number ?? ""}
              onChange={(e) => set("oem_contact_number", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Email">
            <Input
              type="email"
              value={form.oem_contact_email ?? ""}
              onChange={(e) => set("oem_contact_email", e.target.value)}
            />
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Distributor Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Distributor Name">
            <Input
              value={form.distributor_name ?? ""}
              onChange={(e) => set("distributor_name", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Person">
            <Input
              value={form.distributor_contact_person ?? ""}
              onChange={(e) => set("distributor_contact_person", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Number">
            <Input
              value={form.distributor_contact ?? ""}
              onChange={(e) => set("distributor_contact", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Email">
            <Input
              type="email"
              value={form.distributor_contact_email ?? ""}
              onChange={(e) => set("distributor_contact_email", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Department">
            <Input
              value={form.distributor_department ?? ""}
              onChange={(e) => set("distributor_department", e.target.value)}
            />
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Customer &amp; Industry Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="End Customer">
            <Input
              value={form.end_customer_name ?? ""}
              onChange={(e) => set("end_customer_name", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Industry">
            <FinanceSelect value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)}>
              <option value="">None</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Entity Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name">
            <Input value={form.entity_name ?? ""} onChange={(e) => set("entity_name", e.target.value)} />
          </FinanceField>
          <FinanceField label="Entity Email">
            <Input
              type="email"
              value={form.entity_email ?? ""}
              onChange={(e) => set("entity_email", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Entity Address">
            <Input
              value={form.entity_address ?? ""}
              onChange={(e) => set("entity_address", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Organization">
            <Input value={company?.customer_name ?? ""} disabled aria-readonly="true" />
          </FinanceField>
          <FinanceField label="Entity GST No.">
            <Input value={form.entity_gst ?? ""} onChange={(e) => set("entity_gst", e.target.value)} />
          </FinanceField>
          <FinanceField label="Entity Contact Number">
            <Input
              value={form.entity_contact ?? ""}
              onChange={(e) => set("entity_contact", e.target.value)}
            />
          </FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium tracking-tight">Additional Information</h2>
        <FinanceField label="Description">
          <FinanceTextarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </FinanceField>
      </section>

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
