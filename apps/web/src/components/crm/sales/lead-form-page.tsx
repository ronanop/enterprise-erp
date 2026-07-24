"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  MapPin,
  Package,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { SyncedBanner } from "@/components/crm/sales/approval-banner";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  createLeadFromCompany,
  createOem,
  getCompany,
  listEmployeeOptions,
  listLeadSourceOptions,
  listOems,
  type Company,
  type LeadCreateFromCompanyInput,
  type Oem,
  type Option,
} from "@/services/sales-crm-service";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr."] as const;
const PRODUCT_TYPES = [
  "Hardware",
  "Software",
  "Services",
  "Hardware & Services",
  "Hardware & Software",
  "Software & Services",
  "Networking",
  "Cybersecurity",
  "Cloud",
  "AI",
  "Others",
] as const;

type ProductType = (typeof PRODUCT_TYPES)[number];

const SUB_PRODUCT_CATEGORIES: Record<ProductType, readonly string[]> = {
  Hardware: [
    "Servers",
    "Storage",
    "Workstations / Laptops",
    "Peripherals",
    "Networking Hardware",
    "Others",
  ],
  Software: [
    "Enterprise Applications",
    "Operating Systems",
    "Databases",
    "Licensing / Subscriptions",
    "Security Software",
    "Others",
  ],
  Services: [
    "Implementation",
    "Consulting",
    "Managed Services",
    "Support & AMC",
    "Training",
    "Others",
  ],
  "Hardware & Services": [
    "Hardware Supply + Installation",
    "Hardware Supply + Support / AMC",
    "Turnkey Infrastructure",
    "Others",
  ],
  "Hardware & Software": [
    "Bundled Solutions",
    "Appliance / Bundle",
    "System Integration Kit",
    "Others",
  ],
  "Software & Services": [
    "Implementation Services",
    "Customization & Integration",
    "Managed Application Services",
    "Support & AMC",
    "Others",
  ],
  Networking: [
    "Switches",
    "Routers",
    "Wireless / Wi-Fi",
    "SD-WAN",
    "Firewalls (Network)",
    "Cabling / Structured Cabling",
    "Others",
  ],
  Cybersecurity: [
    "Endpoint Security",
    "Network Security",
    "Identity & Access Management",
    "SOC / Managed Detection",
    "Vulnerability Management",
    "Others",
  ],
  Cloud: [
    "IaaS",
    "PaaS",
    "SaaS",
    "Cloud Migration",
    "Managed Cloud",
    "Others",
  ],
  AI: [
    "AI Platforms / Models",
    "Analytics & ML",
    "Computer Vision",
    "NLP / Generative AI",
    "AI Consulting & Implementation",
    "Others",
  ],
  Others: ["General", "Custom / Unspecified", "Others"],
};
const ENGAGEMENT_SCORES = [25, 50, 75, 100] as const;
const REQUIREMENT_TYPES = ["New Requirement", "Expansion"];
const PURCHASE_MODELS = ["CAPEX", "OPEX"];
const DEAL_TYPES = ["Back to Back", "From Market", "From Self"];
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

const NEW_OEM_VALUE = "__new_oem__";

type OemDraft = {
  oem_name: string;
  contact_person: string;
  contact_number: string;
  contact_email: string;
};

const EMPTY_OEM_DRAFT: OemDraft = {
  oem_name: "",
  contact_person: "",
  contact_number: "",
  contact_email: "",
};

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
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [oemCatalog, setOemCatalog] = useState<Oem[]>([]);
  const [oemPick, setOemPick] = useState("");
  const [oemDialogOpen, setOemDialogOpen] = useState(false);
  const [oemDraft, setOemDraft] = useState<OemDraft>(EMPTY_OEM_DRAFT);
  const [oemSaving, setOemSaving] = useState(false);
  const [oemDialogError, setOemDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRow, sources, emps, oems] = await Promise.all([
        getCompany(companyAccountId),
        listLeadSourceOptions().catch(() => []),
        listEmployeeOptions().catch(() => []),
        listOems().catch(() => []),
      ]);
      setCompany(companyRow);
      setLeadSources(sources);
      setEmployees(emps);
      setOemCatalog(oems);
      const sourceLabel = companyRow.source.replaceAll("_", " ").toLowerCase();
      const inheritedSource = sources.find(
        (source) => source.label.trim().toLowerCase() === sourceLabel,
      );
      setForm((f) => {
        const billingAddress = [
          companyRow.billing_street,
          companyRow.billing_city,
          companyRow.billing_state,
          companyRow.billing_code,
          companyRow.billing_country,
        ]
          .filter(Boolean)
          .join(", ");
        return {
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
          street: companyRow.billing_street,
          city: companyRow.billing_city,
          state: companyRow.billing_state,
          zip: companyRow.billing_code,
          country: companyRow.billing_country,
          end_customer_name: f.end_customer_name || "",
          entity_name: companyRow.customer_name || "",
          entity_email: companyRow.customer_email ?? "",
          entity_address: billingAddress,
          entity_contact: companyRow.phone ?? "",
          entity_gst: f.entity_gst || "",
          notes: f.notes || companyRow.description || "",
        };
      });
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

  function onProductTypeChange(value: string) {
    setForm((f) => {
      const options =
        value && value in SUB_PRODUCT_CATEGORIES
          ? SUB_PRODUCT_CATEGORIES[value as ProductType]
          : [];
      const keepCategory =
        f.sub_product_category && options.includes(f.sub_product_category)
          ? f.sub_product_category
          : "";
      return {
        ...f,
        product_type: value,
        sub_product_category: keepCategory,
      };
    });
  }

  const subProductCategoryOptions =
    form.product_type && form.product_type in SUB_PRODUCT_CATEGORIES
      ? SUB_PRODUCT_CATEGORIES[form.product_type as ProductType]
      : [];

  function onOemPickChange(value: string) {
    if (value === NEW_OEM_VALUE) {
      setOemDraft(EMPTY_OEM_DRAFT);
      setOemDialogError(null);
      setOemDialogOpen(true);
      return;
    }
    setOemPick(value);
    if (!value) {
      setForm((f) => ({
        ...f,
        oem_name: "",
        oem_contact_person: "",
        oem_contact_number: "",
        oem_contact_email: "",
      }));
      return;
    }
    const oem = oemCatalog.find((entry) => entry.oem_name === value);
    if (!oem) return;
    setForm((f) => ({
      ...f,
      oem_name: oem.oem_name,
      oem_contact_person: oem.contact_person ?? "",
      oem_contact_number: oem.contact_number ?? "",
      oem_contact_email: oem.contact_email ?? "",
    }));
  }

  function closeOemDialog() {
    setOemDialogOpen(false);
    setOemDraft(EMPTY_OEM_DRAFT);
    setOemDialogError(null);
  }

  async function saveOemDialog() {
    const name = oemDraft.oem_name.trim();
    if (!name) {
      setOemDialogError("OEM name is required.");
      return;
    }
    setOemSaving(true);
    setOemDialogError(null);
    try {
      const created = await createOem({
        oem_name: name,
        contact_person: oemDraft.contact_person.trim() || null,
        contact_number: oemDraft.contact_number.trim() || null,
        contact_email: oemDraft.contact_email.trim() || null,
      });
      setOemCatalog((rows) =>
        [...rows.filter((row) => row.id !== created.id), created].sort((a, b) =>
          a.oem_name.localeCompare(b.oem_name, undefined, { sensitivity: "base" }),
        ),
      );
      setOemPick(created.oem_name);
      setForm((f) => ({
        ...f,
        oem_name: created.oem_name,
        oem_contact_person: created.contact_person ?? "",
        oem_contact_number: created.contact_number ?? "",
        oem_contact_email: created.contact_email ?? "",
      }));
      closeOemDialog();
    } catch (err) {
      setOemDialogError(err instanceof ApiClientError ? err.message : "Failed to save OEM");
    } finally {
      setOemSaving(false);
    }
  }

  async function onSave() {
    const missing: string[] = [];
    if (!form.project_title?.trim()) missing.push("Project Title");
    if (!form.email?.trim()) missing.push("Email");
    if (!form.first_name?.trim()) missing.push("First Name");
    if (!form.last_name?.trim()) missing.push("Last Name");
    if (!form.product_type) missing.push("Product Type");
    if (!form.mobile?.trim()) missing.push("Mobile");
    if (!form.lead_source_id) missing.push("Lead Source");
    if (!form.requirement_type) missing.push("Requirement Type");
    if (!form.purchase_model) missing.push("Purchase Model");
    if (!form.owner_employee_id) missing.push("Lead Owner");
    if (form.expected_amount === undefined || form.expected_amount === null || Number.isNaN(Number(form.expected_amount))) {
      missing.push("Expected Business Amount");
    }
    if (!form.expected_closure_date?.trim()) missing.push("Expected Closure Date");
    if (!form.end_customer_name?.trim()) missing.push("End Customer");
    if (!form.entity_name?.trim()) missing.push("Entity Name");
    if (!form.entity_email?.trim()) missing.push("Entity Email");
    if (!form.entity_address?.trim()) missing.push("Entity Address");
    if (!form.entity_contact?.trim()) missing.push("Entity Contact Number");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await createLeadFromCompany(companyAccountId, {
        ...form,
        assign_to_id: null,
        assigned_date: null,
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
        expected_closure_date: form.expected_closure_date || null,
        distributor_department: null,
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
    <CrmPage>
      {company ? <SyncedBanner from={`Company · ${company.customer_name}`} /> : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="Lead Information" icon={UserPlus}>
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
            <FinanceSelect
              value={form.product_type ?? ""}
              onChange={(e) => onProductTypeChange(e.target.value)}
            >
              <option value="">None</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Mobile *">
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              name="mobile"
              placeholder="+91 98765 43210"
              maxLength={50}
              value={form.mobile ?? ""}
              onChange={(e) => set("mobile", e.target.value)}
            />
          </FinanceField>

          <FinanceField label="Sub Product Category">
            <FinanceSelect
              value={form.sub_product_category ?? ""}
              onChange={(e) => set("sub_product_category", e.target.value)}
              disabled={!form.product_type}
            >
              <option value="">
                {form.product_type ? "None" : "Select product type first"}
              </option>
              {subProductCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </FinanceSelect>
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

          <FinanceField label="Expected Business Amount *">
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

          <FinanceField label="Expected Closure Date *">
            <Input
              type="date"
              value={form.expected_closure_date ?? ""}
              onChange={(e) => set("expected_closure_date", e.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Customer Address Information" icon={MapPin}>
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
      </CrmSection>

      <CrmSection title="OEM Information" icon={Package}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="OEM Name">
            <FinanceSelect
              value={oemPick}
              onChange={(e) => onOemPickChange(e.target.value)}
              aria-label="Select OEM"
            >
              <option value="">None</option>
              {oemCatalog.map((oem) => (
                <option key={oem.id} value={oem.oem_name}>
                  {oem.oem_name}
                </option>
              ))}
              <option value={NEW_OEM_VALUE}>New OEM</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="OEM Contact Person">
            <Input
              value={form.oem_contact_person ?? ""}
              onChange={(e) => set("oem_contact_person", e.target.value)}
              disabled={!oemPick}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Number">
            <Input
              value={form.oem_contact_number ?? ""}
              onChange={(e) => set("oem_contact_number", e.target.value)}
              disabled={!oemPick}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Email">
            <Input
              type="email"
              value={form.oem_contact_email ?? ""}
              onChange={(e) => set("oem_contact_email", e.target.value)}
              disabled={!oemPick}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Distributor Information" icon={Truck}>
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
        </div>
      </CrmSection>

      <CrmSection title="Customer & Industry Information" icon={Users}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="End Customer *">
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
      </CrmSection>

      <CrmSection title="Entity Information" icon={Building2}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name *">
            <Input value={form.entity_name ?? ""} onChange={(e) => set("entity_name", e.target.value)} />
          </FinanceField>
          <FinanceField label="Entity Email *">
            <Input
              type="email"
              value={form.entity_email ?? ""}
              onChange={(e) => set("entity_email", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Entity Address *">
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
          <FinanceField label="Entity Contact Number *">
            <Input
              value={form.entity_contact ?? ""}
              onChange={(e) => set("entity_contact", e.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Additional Information" icon={FileText}>
        <FinanceField label="Description">
          <FinanceTextarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </FinanceField>
      </CrmSection>

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

      <ConfirmDialog
        open={oemDialogOpen}
        title="New OEM"
        description="Save this OEM to the master list. It will appear under OEM and in the lead form."
        confirmLabel="Save OEM"
        cancelLabel="Cancel"
        busy={oemSaving}
        onConfirm={() => void saveOemDialog()}
        onCancel={closeOemDialog}
      >
        <div className="mt-3 space-y-3">
          {oemDialogError ? (
            <p className="text-xs text-destructive" role="alert">
              {oemDialogError}
            </p>
          ) : null}
          <FinanceField label="OEM Name *">
            <Input
              value={oemDraft.oem_name}
              onChange={(e) => setOemDraft((d) => ({ ...d, oem_name: e.target.value }))}
              placeholder="Partner / manufacturer name"
              autoFocus
            />
          </FinanceField>
          <FinanceField label="Contact Person">
            <Input
              value={oemDraft.contact_person}
              onChange={(e) => setOemDraft((d) => ({ ...d, contact_person: e.target.value }))}
            />
          </FinanceField>
          <FinanceField label="Contact Number">
            <Input
              value={oemDraft.contact_number}
              onChange={(e) => setOemDraft((d) => ({ ...d, contact_number: e.target.value }))}
            />
          </FinanceField>
          <FinanceField label="Contact Email">
            <Input
              type="email"
              value={oemDraft.contact_email}
              onChange={(e) => setOemDraft((d) => ({ ...d, contact_email: e.target.value }))}
            />
          </FinanceField>
        </div>
      </ConfirmDialog>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
