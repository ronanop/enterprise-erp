"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Package,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { KycContactDesignationField } from "@/components/crm/sales/kyc-contact-designation-field";
import { LeadDistributorMultiSelect } from "@/components/crm/sales/lead-distributor-multi-select";
import { LeadOemMultiSelect } from "@/components/crm/sales/lead-oem-multi-select";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLeadDistributorNames, parseLeadDistributorNames } from "@/lib/crm/lead-distributor-options";
import { isCrmModuleAdmin } from "@/lib/crm/crm-module-access";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { formatLeadOemNames, parseLeadOemNames } from "@/lib/crm/lead-oem-options";
import {
  isCloudLeadProductType,
  LEAD_PRODUCT_TYPES,
  normalizeLeadProductType,
  subProductOptionsForType,
} from "@/lib/crm/lead-product-options";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ApiClientError, authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";
import {
  createLeadFromCompany,
  getCompany,
  getLeadBlueprint,
  getSalesLead,
  listLeadSourceOptions,
  listCrmMemberOptions,
  listSellingEntities,
  markLeadLost,
  updateSalesLead,
  type BlueprintState,
  type Company,
  type LeadCreateFromCompanyInput,
  type Option,
  type SalesLead,
  type SellingEntity,
} from "@/services/sales-crm-service";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr."] as const;
const ENGAGEMENT_SCORES = [25, 50, 75, 100] as const;

const DEFAULT_ENTITY_EMAIL = "info@cachedigitech.com";
const DEFAULT_ENTITY_CONTACT = "18003094333";
const REQUIREMENT_TYPES = ["New Requirement", "Expansion"];
const PURCHASE_MODELS = ["CAPEX", "OPEX"];
const DEAL_TYPES = ["back to back", "self-generated", "from market"] as const;
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
  designation: "",
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

export function LeadFormPage({
  companyAccountId,
  leadId,
}: {
  companyAccountId: string;
  leadId?: string;
}) {
  const router = useRouter();
  const { user, adminModuleKeys } = useAuthUser();
  const isAdmin = isCrmModuleAdmin(adminModuleKeys, user?.userType);
  const isEdit = Boolean(leadId);
  const [company, setCompany] = useState<Company | null>(null);
  const [existingLead, setExistingLead] = useState<SalesLead | null>(null);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [leadOwnerLabel, setLeadOwnerLabel] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [form, setForm] = useState<LeadCreateFromCompanyInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [entityCatalog, setEntityCatalog] = useState<SellingEntity[]>([]);
  const [entityPick, setEntityPick] = useState("");
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [crmMembers, setCrmMembers] = useState<Option[]>([]);

  const selectedOemNames = parseLeadOemNames(form.oem_name);
  const selectedDistributorNames = parseLeadDistributorNames(form.distributor_name);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRow, sources, meResponse, entities, leadRow, memberOptions] = await Promise.all([
        getCompany(companyAccountId),
        listLeadSourceOptions().catch(() => []),
        authService.me().catch(() => null),
        listSellingEntities().catch(() => []),
        leadId ? getSalesLead(leadId).catch(() => null) : Promise.resolve(null),
        listCrmMemberOptions().catch(() => [] as Option[]),
      ]);
      setCrmMembers(memberOptions);
      if (leadId) {
        const bp = await getLeadBlueprint(leadId).catch(() => null);
        setBlueprint(bp);
      } else {
        setBlueprint(null);
      }
      setExistingLead(leadRow);
      const mePayload = meResponse?.data;
      let meUser: UserProfile | undefined;
      if (mePayload && typeof mePayload === "object" && "user" in mePayload) {
        meUser = (mePayload as { user?: UserProfile }).user;
      } else {
        meUser = mePayload as UserProfile | undefined;
      }
      const loggedInLabel =
        meUser?.display_name?.trim() ||
        meUser?.full_name?.trim() ||
        meUser?.email?.trim() ||
        "";
      setLeadOwnerLabel(loggedInLabel);
      setCompany(companyRow);
      setLeadSources(sources);
      setEntityCatalog(entities);
      const rawIndustry = companyRow.industry ?? "";
      if (rawIndustry && !INDUSTRIES.includes(rawIndustry)) {
        setIndustryOther(rawIndustry);
      } else {
        setIndustryOther("");
      }
      const sourceLabel = companyRow.source.replaceAll("_", " ").toLowerCase();
      const inheritedSource = sources.find(
        (source) => source.label.trim().toLowerCase() === sourceLabel,
      );
      setForm((f) => {
        if (leadRow) {
          return {
            ...EMPTY,
            branch_id: leadRow.branch_id,
            salutation: leadRow.salutation ?? "",
            first_name: leadRow.first_name ?? "",
            last_name: leadRow.last_name ?? "",
            designation: leadRow.designation ?? "",
            mobile: leadRow.mobile ?? "",
            email: leadRow.email ?? "",
            lead_source_id: leadRow.lead_source_id ?? "",
            expected_amount: leadRow.expected_amount ?? undefined,
            expected_closure_date: leadRow.expected_closure_date ?? "",
            product_type: leadRow.product_type ?? "",
            sub_product_category: leadRow.sub_product_category ?? "",
            sub_product: leadRow.sub_product ?? "",
            sub_product_other: leadRow.sub_product_other ?? "",
            engagement_score: leadRow.engagement_score ?? undefined,
            portal_link: leadRow.portal_link ?? "",
            project_title: leadRow.project_title ?? "",
            requirement_type: leadRow.requirement_type ?? "",
            purchase_model: leadRow.purchase_model ?? "",
            dr_number: leadRow.dr_number ?? "",
            new_dr_number: leadRow.new_dr_number ?? "",
            deal_type: leadRow.deal_type ?? "",
            industry: leadRow.industry ?? "",
            street: leadRow.street ?? "",
            city: leadRow.city ?? "",
            state: leadRow.state ?? "",
            zip: leadRow.zip ?? "",
            country: leadRow.country ?? "",
            oem_name: leadRow.oem_name ?? "",
            oem_contact_person: leadRow.oem_contact_person ?? "",
            oem_contact_number: leadRow.oem_contact_number ?? "",
            oem_contact_email: leadRow.oem_contact_email ?? "",
            distributor_name: leadRow.distributor_name ?? "",
            distributor_contact: leadRow.distributor_contact ?? "",
            distributor_contact_person: leadRow.distributor_contact_person ?? "",
            distributor_contact_email: leadRow.distributor_contact_email ?? "",
            end_customer_name: leadRow.end_customer_name ?? "",
            entity_name: leadRow.entity_name ?? "",
            entity_email: leadRow.entity_email ?? "",
            entity_address: leadRow.entity_address ?? "",
            entity_gst: leadRow.entity_gst ?? "",
            entity_contact: leadRow.entity_contact ?? "",
            owner_employee_id: leadRow.owner_employee_id ?? "",
            notes: leadRow.notes ?? "",
          };
        }
        return {
          ...f,
          branch_id: companyRow.branch_id,
          first_name: companyRow.first_name ?? "",
          last_name: companyRow.last_name ?? "",
          mobile: companyRow.phone ?? "",
          email: companyRow.customer_email ?? "",
          lead_source_id: f.lead_source_id || inheritedSource?.id || "",
          industry:
            rawIndustry && !INDUSTRIES.includes(rawIndustry) ? rawIndustry : companyRow.industry,
          portal_link: f.portal_link || companyRow.website || "",
          street: companyRow.billing_street,
          city: companyRow.billing_city,
          state: companyRow.billing_state,
          zip: companyRow.billing_code,
          country: companyRow.billing_country,
          end_customer_name: f.end_customer_name || "",
          notes: f.notes || companyRow.description || "",
        };
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function set<K extends keyof LeadCreateFromCompanyInput>(key: K, value: LeadCreateFromCompanyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onProductTypeChange(value: string) {
    setForm((f) => {
      const normalized = normalizeLeadProductType(value);
      const options = subProductOptionsForType(normalized ?? value);
      const keepCategory =
        f.sub_product_category && options.includes(f.sub_product_category)
          ? f.sub_product_category
          : "";
      return {
        ...f,
        product_type: normalized ?? value,
        sub_product_category: keepCategory,
        sub_product: normalized === "Cloud" ? "" : f.sub_product,
        sub_product_other: normalized === "Cloud" ? "" : f.sub_product_other,
      };
    });
  }

  const normalizedProductType = normalizeLeadProductType(form.product_type);
  const subProductCategoryOptions = subProductOptionsForType(form.product_type);
  const isCloudProduct = isCloudLeadProductType(form.product_type);

  function onOemNamesChange(names: string[]) {
    setForm((f) => ({
      ...f,
      oem_name: formatLeadOemNames(names),
      ...(names.length === 0
        ? {
          oem_contact_person: "",
          oem_contact_number: "",
          oem_contact_email: "",
        }
        : {}),
    }));
  }

  function onDistributorNamesChange(names: string[]) {
    setForm((f) => ({
      ...f,
      distributor_name: formatLeadDistributorNames(names),
      ...(names.length === 0
        ? {
          distributor_contact_person: "",
          distributor_contact: "",
          distributor_contact_email: "",
        }
        : {}),
    }));
  }

  function onEntityPickChange(value: string) {
    setEntityPick(value);
    if (!value) {
      setForm((f) => ({
        ...f,
        entity_name: "",
        entity_email: "",
        entity_address: "",
        entity_gst: "",
        entity_contact: "",
      }));
      return;
    }
    const entity = entityCatalog.find((entry) => entry.id === value);
    if (!entity) return;
    setForm((f) => ({
      ...f,
      entity_name: entity.entity_name,
      entity_email: entity.entity_email?.trim() || DEFAULT_ENTITY_EMAIL,
      entity_address: entity.entity_address ?? "",
      entity_gst: entity.entity_gst ?? "",
      entity_contact: entity.entity_contact?.trim() || DEFAULT_ENTITY_CONTACT,
    }));
  }

  async function onSave() {
    const missing: string[] = [];
    if (!form.project_title?.trim()) missing.push("Project Title");
    if (!form.email?.trim()) missing.push("Email");
    if (!form.first_name?.trim()) missing.push("First Name");
    if (!form.last_name?.trim()) missing.push("Last Name");
    if (!form.product_type) missing.push("Product Type");
    if (!form.mobile?.trim()) missing.push("Mobile");
    if (!form.designation?.trim()) missing.push("Designation");
    if (!form.lead_source_id) missing.push("Lead Source");
    if (!form.sub_product_category?.trim()) {
      missing.push(isCloudLeadProductType(form.product_type) ? "Sub Product" : "Sub Product Category");
    }
    if (!form.requirement_type) missing.push("Requirement Type");
    if (!form.purchase_model) missing.push("Purchase Model");
    if (form.expected_amount === undefined || form.expected_amount === null || Number.isNaN(Number(form.expected_amount))) {
      missing.push("Expected Order Value");
    }
    if (!form.expected_closure_date?.trim()) missing.push("Expected Closure Date");
    if (!form.end_customer_name?.trim()) missing.push("End Customer");
    if (!form.entity_name?.trim()) missing.push("Entity Name");
    if (!form.entity_address?.trim()) missing.push("Entity Address");
    if (!form.entity_contact?.trim()) missing.push("Entity Contact Number");
    if (!form.oem_name?.trim()) missing.push("OEM Name");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { owner_employee_id: _owner, ...leadBody } = form;
      const payload = {
        ...leadBody,
        assign_to_id: null,
        assigned_date: null,
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
        expected_closure_date: form.expected_closure_date || null,
        distributor_department: null,
      };
      if (isEdit && leadId && existingLead) {
        const ownerPatch =
          isAdmin && form.owner_employee_id
            ? { owner_employee_id: form.owner_employee_id }
            : {};
        await updateSalesLead(leadId, {
          ...payload,
          ...ownerPatch,
          version: existingLead.version,
        });
        router.push(`/crm/leads/${leadId}`);
        return;
      }
      const lead = await createLeadFromCompany(companyAccountId, payload);
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

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    if (!leadId || !existingLead) return;
    if (action === "lost") {
      await markLeadLost(leadId, String(payload.reason ?? payload.remark ?? ""));
      const bp = await getLeadBlueprint(leadId);
      setBlueprint(bp);
      const leadRow = await getSalesLead(leadId);
      setExistingLead(leadRow);
    }
  }

  const ownerDisplayLabel =
    crmMembers.find((member) => member.id === form.owner_employee_id)?.label ?? leadOwnerLabel;

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
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      {isEdit && existingLead && blueprint ? (
        <BlueprintActions
          allowedActions={blueprint.allowed_actions}
          locked={blueprint.locked}
          currentStageLabel={resolveSalesStageLabel({
            entityType: "lead",
            blueprintState: blueprint.state,
            locked: blueprint.locked,
            lead: existingLead,
          })}
          excludeActions={["convert"]}
          onAction={onBlueprintAction}
        />
      ) : (
        <BlueprintActions
          allowedActions={[]}
          currentStageLabel="Draft Lead"
          onAction={async () => {}}
        />
      )}

      <CrmSection title="Lead Information" icon={UserPlus}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Company">
            <Input value={company?.customer_name ?? ""} disabled aria-readonly="true" />
          </FinanceField>
          <FinanceField label="Project Title *">
            <Input value={form.project_title ?? ""} onChange={(e) => set("project_title", e.target.value)} />
          </FinanceField>

          <FinanceField label="First Name *">
            <div className="flex gap-2">
              <FinanceSelect
                value={form.salutation ?? ""}
                onChange={(e) => set("salutation", e.target.value)}
                className="w-14 shrink-0 px-1.5"
              >
                <option value="" disabled hidden />
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

          <FinanceField label="Email *">
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
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

          <FinanceField label="Designation *">
            <KycContactDesignationField
              value={form.designation ?? ""}
              onChange={(designation) => set("designation", designation)}
            />
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

          <FinanceField label="Product Type *">
            <FinanceSelect
              value={form.product_type ?? ""}
              onChange={(e) => onProductTypeChange(e.target.value)}
            >
              <option value="">None</option>
              {LEAD_PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label={isCloudProduct ? "Sub Product *" : "Sub Product Category *"}>
            <FinanceSelect
              value={form.sub_product_category ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                setForm((f) => ({
                  ...f,
                  sub_product_category: next,
                  sub_product: isCloudProduct ? "" : f.sub_product,
                  sub_product_other: isCloudProduct ? "" : f.sub_product_other,
                }));
              }}
              disabled={!normalizedProductType}
              required
            >
              <option value="">
                {normalizedProductType ? "None" : "Select product type first"}
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

          {!isCloudProduct ? (
            <FinanceField label="Sub Product">
              <Input value={form.sub_product ?? ""} onChange={(e) => set("sub_product", e.target.value)} />
            </FinanceField>
          ) : null}
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
                  {score}%
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="DR Number">
            <Input value={form.dr_number ?? ""} onChange={(e) => set("dr_number", e.target.value)} />
          </FinanceField>

          <FinanceField label="Sourcing Channel">
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
            {isAdmin ? (
              <FinanceSelect
                value={form.owner_employee_id ?? ""}
                onChange={(e) => set("owner_employee_id", e.target.value)}
              >
                <option value="">Select owner</option>
                {crmMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </FinanceSelect>
            ) : (
              <Input
                value={ownerDisplayLabel || "—"}
                disabled
                aria-readonly="true"
                title="Assigned from your logged-in user account"
              />
            )}
          </FinanceField>

          <FinanceField label="Expected Order Value *">
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
          <FinanceField label="OEM Name *">
            <LeadOemMultiSelect value={selectedOemNames} onChange={onOemNamesChange} />
          </FinanceField>
          <FinanceField label="OEM Contact Person">
            <Input
              value={form.oem_contact_person ?? ""}
              onChange={(e) => set("oem_contact_person", e.target.value)}
              disabled={selectedOemNames.length === 0}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Number">
            <Input
              value={form.oem_contact_number ?? ""}
              onChange={(e) => set("oem_contact_number", e.target.value)}
              disabled={selectedOemNames.length === 0}
            />
          </FinanceField>
          <FinanceField label="OEM Contact Email">
            <Input
              type="email"
              value={form.oem_contact_email ?? ""}
              onChange={(e) => set("oem_contact_email", e.target.value)}
              disabled={selectedOemNames.length === 0}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Distributor Information" icon={Truck}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Distributor Name">
            <LeadDistributorMultiSelect
              value={selectedDistributorNames}
              onChange={onDistributorNamesChange}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Person">
            <Input
              value={form.distributor_contact_person ?? ""}
              onChange={(e) => set("distributor_contact_person", e.target.value)}
              disabled={selectedDistributorNames.length === 0}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Number">
            <Input
              value={form.distributor_contact ?? ""}
              onChange={(e) => set("distributor_contact", e.target.value)}
              disabled={selectedDistributorNames.length === 0}
            />
          </FinanceField>
          <FinanceField label="Distributor Contact Email">
            <Input
              type="email"
              value={form.distributor_contact_email ?? ""}
              onChange={(e) => set("distributor_contact_email", e.target.value)}
              disabled={selectedDistributorNames.length === 0}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="End Customer Detail" icon={Users}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="End Customer *">
            <Input
              value={form.end_customer_name ?? ""}
              onChange={(e) => set("end_customer_name", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="Industry">
            <FinanceSelect
              value={
                !form.industry || INDUSTRIES.includes(form.industry)
                  ? (form.industry ?? "")
                  : "Others"
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === "Others") {
                  set("industry", industryOther.trim() || "Others");
                } else {
                  setIndustryOther("");
                  set("industry", value);
                }
              }}
            >
              <option value="">None</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          {form.industry === "Others" ||
            (form.industry && !INDUSTRIES.includes(form.industry)) ? (
            <FinanceField label="Specify industry">
              <Input
                value={
                  form.industry === "Others"
                    ? industryOther
                    : INDUSTRIES.includes(form.industry ?? "")
                      ? ""
                      : (form.industry ?? "")
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setIndustryOther(value);
                  set("industry", value.trim() || "Others");
                }}
              />
            </FinanceField>
          ) : null}
        </div>
      </CrmSection>

      <CrmSection title="Entity Information" icon={Building2}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name *">
            <FinanceSelect
              value={entityPick}
              onChange={(e) => onEntityPickChange(e.target.value)}
              aria-label="Select selling entity"
              required
            >
              <option value="">Select entity</option>
              {entityCatalog.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.entity_name}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Entity Email">
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
      </CrmSection>

      <div className="flex justify-end gap-2">
        <Link
          href={`/crm/companies/${companyAccountId}`}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
        >
          Cancel
        </Link>
        <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
          {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create Lead"}
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
