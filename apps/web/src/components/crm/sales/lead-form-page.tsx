"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Handshake,
  MessageSquareText,
  MapPin,
  Package,
  Truck,
  UserPlus,
} from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { CrmCustomFieldsSection } from "@/components/crm/sales/crm-custom-fields-section";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { KycContactDesignationField } from "@/components/crm/sales/kyc-contact-designation-field";
import { LeadPartnerRowsTable } from "@/components/crm/sales/lead-partner-rows-table";
import { LeadProductTypeMultiSelect } from "@/components/crm/sales/lead-product-type-multi-select";
import { LeadSubProductCategoryMultiSelect } from "@/components/crm/sales/lead-sub-product-category-multi-select";
import {
  RequiredFieldsDialog,
  isCustomFieldValueEmpty,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadCrmDistributorOptions,
} from "@/lib/crm/lead-distributor-options";
import { LEAD_OEM_OPTIONS } from "@/lib/crm/lead-oem-options";
import {
  emptyLeadPartnerRow,
  formatDistributorPartnerFields,
  formatOemPartnerFields,
  parseDistributorPartnerRows,
  parseOemPartnerRows,
  type LeadPartnerRow,
} from "@/lib/crm/lead-partner-rows";
import {
  companySourceToLeadMatchKey,
  isEventLeadSourceLabel,
  isMultiTierLeadSourceLabel,
  normalizeSourceMatchKey,
  sortLeadSourcesByCompanyOrder,
} from "@/lib/crm/company-lead-sources";
import { isCrmModuleAdmin } from "@/lib/crm/crm-module-access";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import {
  formatLeadProductTypes,
  formatLeadSubProductCategories,
  isCloudLeadProductType,
  parseLeadProductTypes,
  parseLeadSubProductCategories,
  subProductOptionsForTypes,
} from "@/lib/crm/lead-product-options";
import {
  HARDWARE_SOURCING_CHANNELS,
  SERVICE_SOURCING_CHANNELS,
  formatLeadSourcingChannels,
  leadNeedsHardwareSourcing,
  leadNeedsServiceSourcing,
  parseLeadSourcingChannels,
} from "@/lib/crm/lead-sourcing-channels";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { formFieldsMap, pushRequired } from "@/lib/crm/crm-settings-ui";
import { ApiClientError, authService } from "@/services/api-client";
import type { UserProfile } from "@/types/api";
import { catalogOptions, customFormFields } from "@/services/crm-settings-service";
import { listCompanyGst } from "@/services/crm-deal-controls-service";

import {
  createLeadFromCompany,
  getCompany,
  getLeadBlueprint,
  getSalesLead,
  listLeadSourceOptions,
  listMarketingEventOptions,
  listCrmMemberOptions,
  listSellingEntities,
  markLeadLost,
  peekNextLeadDrNumber,
  updateSalesLead,
  type BlueprintState,
  type Company,
  type LeadCreateFromCompanyInput,
  type Option,
  type SalesLead,
  type SellingEntity,
} from "@/services/sales-crm-service";
import { formatCrmCode } from "@/lib/crm/format-crm-code";

const DEFAULT_ENTITY_EMAIL = "info@cachedigitech.com";
const DEFAULT_ENTITY_CONTACT = "18003094333";

const FALLBACK_INDUSTRIES = [
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
const FALLBACK_REQUIREMENT_TYPES = ["New Requirement", "Expansion"];
const FALLBACK_PURCHASE_MODELS = ["CAPEX", "OPEX"];
const FALLBACK_ENGAGEMENT_SCORES = [25, 50, 75, 100] as const;

const EMPTY: LeadCreateFromCompanyInput = {
  branch_id: "",
  salutation: "",
  first_name: "",
  last_name: "",
  designation: "",
  mobile: "",
  email: "",
  lead_source_id: "",
  partner_names: "",
  marketing_event_id: "",
  owner_employee_id: "",
  assign_to_id: "",
  assigned_date: "",
  expected_amount: undefined,
  committed_amount: undefined,
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
  sale_type: "",
  entity_name: "",
  entity_email: "",
  entity_address: "",
  entity_gst: "",
  entity_contact: "",
  requires_boq: true,
  /** SOW is required only when Services is in product_type (derived on save). */
  requires_sow: false,
  notes: "",
  presales_owner_id: "",
};

type LeadSaleType = "sell_through" | "sell_to";

function resolveLeadSaleType(
  saleType: string | null | undefined,
  endCustomerName: string | null | undefined,
  accountName: string | null | undefined,
): LeadSaleType | "" {
  const normalized = (saleType || "").trim().toLowerCase();
  if (normalized === "sell_through" || normalized === "sell_to") {
    return normalized;
  }
  const endCustomer = (endCustomerName || "").trim().toLowerCase();
  const account = (accountName || "").trim().toLowerCase();
  if (!endCustomer) return "";
  if (account && endCustomer === account) return "sell_to";
  return "sell_through";
}

export function LeadFormPage({
  companyAccountId,
  leadId,
}: {
  companyAccountId: string;
  leadId?: string;
}) {
  const router = useRouter();
  const { user, adminModuleKeys } = useAuthUser();
  const { settings } = useCrmSettingsEffective();
  const leadFields = formFieldsMap(settings, "lead");
  const isAdmin = isCrmModuleAdmin(adminModuleKeys, user?.userType);
  const isEdit = Boolean(leadId);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyGstin, setCompanyGstin] = useState("");
  const [existingLead, setExistingLead] = useState<SalesLead | null>(null);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [marketingEvents, setMarketingEvents] = useState<Option[]>([]);
  const [leadOwnerLabel, setLeadOwnerLabel] = useState("");
  const [form, setForm] = useState<LeadCreateFromCompanyInput>(EMPTY);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [mandateFields, setMandateFields] = useState<string[]>([]);
  const [entityCatalog, setEntityCatalog] = useState<SellingEntity[]>([]);
  const [entityPick, setEntityPick] = useState("");
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [crmMembers, setCrmMembers] = useState<Option[]>([]);
  const [nextDrNumber, setNextDrNumber] = useState("");
  const [oemRows, setOemRows] = useState<LeadPartnerRow[]>([emptyLeadPartnerRow()]);
  const [distributorRows, setDistributorRows] = useState<LeadPartnerRow[]>([emptyLeadPartnerRow()]);
  const [distributorNameOptions, setDistributorNameOptions] = useState<string[]>(["IN STOCK"]);

  const industryCatalogValues = useMemo(() => {
    const opts = catalogOptions(settings, "industries");
    if (opts.length > 0) return new Set(opts.map((option) => option.value));
    return new Set(FALLBACK_INDUSTRIES);
  }, [settings]);

  const requirementTypeOptions = useMemo(() => {
    const opts = catalogOptions(settings, "requirement_types");
    if (opts.length > 0) return opts;
    return FALLBACK_REQUIREMENT_TYPES.map((value, order) => ({
      value,
      label: value,
      enabled: true,
      order,
    }));
  }, [settings]);

  const purchaseModelOptions = useMemo(() => {
    const opts = catalogOptions(settings, "purchase_models");
    if (opts.length > 0) return opts;
    return FALLBACK_PURCHASE_MODELS.map((value, order) => ({
      value,
      label: value,
      enabled: true,
      order,
    }));
  }, [settings]);

  const engagementScoreOptions = useMemo(() => {
    const opts = catalogOptions(settings, "engagement_scores");
    if (opts.length > 0) return opts;
    return FALLBACK_ENGAGEMENT_SCORES.map((value, order) => ({
      value: String(value),
      label: `${value}%`,
      enabled: true,
      order,
    }));
  }, [settings]);

  const productTypeOptions = useMemo(() => {
    const opts = catalogOptions(settings, "product_types");
    if (opts.length === 0) return undefined;
    return opts.map((option) => option.value);
  }, [settings]);

  const hardwareChannelOptions = useMemo(() => {
    const opts = catalogOptions(settings, "hardware_sourcing_channels");
    if (opts.length > 0) return opts.map((option) => option.value);
    return [...HARDWARE_SOURCING_CHANNELS];
  }, [settings]);

  const serviceChannelOptions = useMemo(() => {
    const opts = catalogOptions(settings, "service_sourcing_channels");
    if (opts.length > 0) return opts.map((option) => option.value);
    return [...SERVICE_SOURCING_CHANNELS];
  }, [settings]);

  const oemNameOptions = useMemo(() => {
    const opts = catalogOptions(settings, "oem_names");
    if (opts.length > 0) return opts.map((option) => option.label || option.value);
    return undefined;
  }, [settings]);

  const distributorCatalogOptions = useMemo(() => {
    const opts = catalogOptions(settings, "distributor_names");
    if (opts.length > 0) return opts.map((option) => option.label || option.value);
    return [] as string[];
  }, [settings]);

  const selectedLeadSource = leadSources.find((source) => source.id === form.lead_source_id);
  const isMultiTierSource = isMultiTierLeadSourceLabel(selectedLeadSource?.label);
  const isEventSource = isEventLeadSourceLabel(selectedLeadSource?.label);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companyRow = await getCompany(companyAccountId);
      const orgCompanyId = companyRow.company_id;
      const [gstRows, sources, events, meResponse, entities, leadRow, memberOptions] = await Promise.all([
        listCompanyGst(companyAccountId).catch(() => []),
        listLeadSourceOptions(orgCompanyId).catch(() => []),
        listMarketingEventOptions().catch(() => [] as Option[]),
        authService.me().catch(() => null),
        listSellingEntities(orgCompanyId).catch(() => []),
        leadId ? getSalesLead(leadId).catch(() => null) : Promise.resolve(null),
        listCrmMemberOptions().catch(() => [] as Option[]),
      ]);
      setCrmMembers(memberOptions);
      if (leadId) {
        // May auto-convert when BOQ/SOW are done — then open opportunity Transitions.
        const bp = await getLeadBlueprint(leadId).catch(() => null);
        const refreshedLead = await getSalesLead(leadId).catch(() => leadRow);
        if (
          refreshedLead?.converted_opportunity_id &&
          (refreshedLead.blueprint_state === "converted" || bp?.state === "converted")
        ) {
          router.replace(`/crm/opportunities/${refreshedLead.converted_opportunity_id}`);
          return;
        }
        setBlueprint(bp);
        setExistingLead(refreshedLead);
      } else {
        setBlueprint(null);
        setExistingLead(leadRow);
      }
      if (leadRow?.blueprint_state === "lost") {
        setError("Lost leads cannot be edited.");
      }
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
      const ownerFromEmployee =
        meUser?.employee_id && memberOptions.some((member) => member.id === meUser.employee_id)
          ? meUser.employee_id
          : memberOptions.find(
            (member) =>
              member.email?.trim().toLowerCase() === meUser?.email?.trim().toLowerCase(),
          )?.id ?? "";
      setCompany(companyRow);
      setCompanyGstin(
        (gstRows.find((row) => row.is_head_office) ?? gstRows[0])?.gstin?.trim() ?? "",
      );
      setLeadSources(sortLeadSourcesByCompanyOrder(sources));
      setMarketingEvents(events);
      setEntityCatalog(entities);
      const rawIndustry = companyRow.industry ?? "";
      const companySourceKey = companySourceToLeadMatchKey(companyRow.source ?? "");
      const inheritedSource = sources.find(
        (source) => normalizeSourceMatchKey(source.label) === companySourceKey,
      );
      if (leadRow) {
        setCustomFields(
          leadRow.custom_fields && typeof leadRow.custom_fields === "object"
            ? { ...leadRow.custom_fields }
            : {},
        );
      } else {
        setCustomFields({});
      }
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
            partner_names: leadRow.partner_names ?? "",
            marketing_event_id: leadRow.marketing_event_id ?? "",
            expected_amount: leadRow.expected_amount ?? undefined,
            committed_amount: leadRow.committed_amount ?? undefined,
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
            sale_type: resolveLeadSaleType(
              leadRow.sale_type,
              leadRow.end_customer_name,
              companyRow.customer_name,
            ),
            entity_name: leadRow.entity_name ?? "",
            entity_email: leadRow.entity_email ?? "",
            entity_address: leadRow.entity_address ?? "",
            entity_gst: leadRow.entity_gst ?? "",
            entity_contact: leadRow.entity_contact ?? "",
            requires_boq: Boolean(leadRow.requires_boq),
            requires_sow: Boolean(leadRow.requires_sow),
            owner_employee_id: leadRow.owner_employee_id ?? "",
            presales_owner_id: leadRow.presales_owner_id ?? "",
            notes: leadRow.notes ?? "",
          };
        }
        return {
          ...f,
          branch_id: companyRow.branch_id,
          owner_employee_id: ownerFromEmployee || f.owner_employee_id,
          first_name: companyRow.first_name ?? "",
          last_name: companyRow.last_name ?? "",
          designation: companyRow.role ?? "",
          mobile: companyRow.phone ?? "",
          email: companyRow.customer_email ?? "",
          lead_source_id: f.lead_source_id || inheritedSource?.id || "",
          partner_names:
            f.partner_names ||
            (isMultiTierLeadSourceLabel(inheritedSource?.label)
              ? companyRow.partner_names ?? ""
              : ""),
          marketing_event_id:
            f.marketing_event_id ||
            (isEventLeadSourceLabel(inheritedSource?.label)
              ? companyRow.marketing_event_id ?? ""
              : ""),
          industry:
            rawIndustry && !industryCatalogValues.has(rawIndustry)
              ? rawIndustry
              : companyRow.industry,
          portal_link: f.portal_link || companyRow.website || "",
          street: companyRow.billing_street,
          city: companyRow.billing_city,
          state: companyRow.billing_state,
          zip: companyRow.billing_code,
          country: companyRow.billing_country,
          end_customer_name: f.end_customer_name || "",
          notes: "",
        };
      });
      if (leadRow) {
        setNextDrNumber("");
        setOemRows(parseOemPartnerRows(leadRow));
        setDistributorRows(parseDistributorPartnerRows(leadRow));
      } else {
        const preview = await peekNextLeadDrNumber(companyRow.company_id).catch(() => "");
        setNextDrNumber(preview);
        setOemRows([emptyLeadPartnerRow()]);
        setDistributorRows([emptyLeadPartnerRow()]);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [companyAccountId, industryCatalogValues, leadId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function set<K extends keyof LeadCreateFromCompanyInput>(key: K, value: LeadCreateFromCompanyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onProductTypesChange(types: string[]) {
    setForm((f) => {
      const options = new Set(subProductOptionsForTypes(types));
      const keepCategories = parseLeadSubProductCategories(f.sub_product_category).filter((cat) =>
        options.has(cat),
      );
      const cloudSelected = types.includes("Cloud");
      const channels = parseLeadSourcingChannels(f.deal_type);
      if (!leadNeedsHardwareSourcing(types)) delete channels.hardware;
      if (!leadNeedsServiceSourcing(types)) delete channels.service;
      return {
        ...f,
        product_type: formatLeadProductTypes(types),
        sub_product_category: formatLeadSubProductCategories(keepCategories),
        sub_product: cloudSelected ? "" : f.sub_product,
        sub_product_other: cloudSelected ? "" : f.sub_product_other,
        deal_type: formatLeadSourcingChannels(channels, types),
        // SOW My Jobs only when Services is selected.
        requires_sow: types.includes("Services"),
        requires_boq: !cloudSelected,
      };
    });
  }

  function onSubProductCategoriesChange(categories: string[]) {
    setForm((f) => ({
      ...f,
      sub_product_category: formatLeadSubProductCategories(categories),
      sub_product: isCloudLeadProductType(f.product_type) ? "" : f.sub_product,
      sub_product_other: isCloudLeadProductType(f.product_type) ? "" : f.sub_product_other,
    }));
  }

  const selectedProductTypes = parseLeadProductTypes(form.product_type);
  const selectedSubProductCategories = parseLeadSubProductCategories(form.sub_product_category);
  const subProductCategoryOptions = useMemo(() => {
    const catalogOpts = catalogOptions(settings, "sub_product_categories");
    if (catalogOpts.length > 0 && selectedProductTypes.length > 0) {
      const parents = new Set(selectedProductTypes.map((t) => t.trim()));
      const fromCatalog = catalogOpts
        .filter((o) => {
          const parent = String(o.meta?.parent_value ?? "").trim();
          return !parent || parents.has(parent);
        })
        .map((o) => o.label || o.value);
      if (fromCatalog.length > 0) return fromCatalog;
    }
    return [...subProductOptionsForTypes(selectedProductTypes)];
  }, [settings, selectedProductTypes]);
  const isCloudProduct = isCloudLeadProductType(form.product_type);
  const showHardwareSourcing = leadNeedsHardwareSourcing(selectedProductTypes);
  const showServiceSourcing = leadNeedsServiceSourcing(selectedProductTypes);
  const sourcingChannels = parseLeadSourcingChannels(form.deal_type);

  function setSourcingChannel(kind: "hardware" | "service", value: string | string[]) {
    setForm((f) => {
      const types = parseLeadProductTypes(f.product_type);
      const next = { ...parseLeadSourcingChannels(f.deal_type) };
      if (kind === "hardware") {
        const selected = Array.isArray(value)
          ? value
          : value
            ? [value]
            : [];
        if (selected.length > 0) next.hardware = selected;
        else delete next.hardware;
      } else {
        const text = Array.isArray(value) ? value[0] ?? "" : value;
        if (text) next.service = text;
        else delete next.service;
      }
      return { ...f, deal_type: formatLeadSourcingChannels(next, types) };
    });
  }

  function toggleHardwareSourcingChannel(channel: string) {
    const current = sourcingChannels.hardware ?? [];
    const next = current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel];
    setSourcingChannel("hardware", next);
  }

  function onOemRowsChange(rows: LeadPartnerRow[]) {
    setOemRows(rows);
    setForm((f) => ({ ...f, ...formatOemPartnerFields(rows) }));
  }

  function onDistributorRowsChange(rows: LeadPartnerRow[]) {
    setDistributorRows(rows);
    setForm((f) => ({ ...f, ...formatDistributorPartnerFields(rows) }));
  }

  useEffect(() => {
    let cancelled = false;
    const selectedNames = distributorRows
      .map((row) => row.name.trim())
      .filter(Boolean)
      .join(", ");
    void loadCrmDistributorOptions(selectedNames).then((options) => {
      if (cancelled) return;
      const merged = [...options];
      for (const name of distributorCatalogOptions) {
        if (!merged.includes(name)) merged.push(name);
      }
      setDistributorNameOptions(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [distributorRows, distributorCatalogOptions]);

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
      if (!isEdit) {
        void peekNextLeadDrNumber(company?.company_id).then(setNextDrNumber).catch(() => setNextDrNumber(""));
      }
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
    if (!isEdit) {
      void peekNextLeadDrNumber(company?.company_id, entity.entity_name)
        .then(setNextDrNumber)
        .catch(() => setNextDrNumber(""));
    }
  }

  async function onSave() {
    if (isEdit && existingLead?.blueprint_state === "lost") {
      setError("Lost leads cannot be edited.");
      return;
    }
    const missing: string[] = [];
    pushRequired(missing, leadFields, "project_title", "Project Title", !form.project_title?.trim(), false);
    pushRequired(missing, leadFields, "email", "Email", !form.email?.trim(), true);
    pushRequired(missing, leadFields, "first_name", "First Name", !form.first_name?.trim(), true);
    pushRequired(missing, leadFields, "last_name", "Last Name", !form.last_name?.trim(), false);
    pushRequired(
      missing,
      leadFields,
      "product_type",
      "Product Type",
      !form.product_type?.trim() || selectedProductTypes.length === 0,
      true,
    );
    pushRequired(missing, leadFields, "mobile", "Mobile", !form.mobile?.trim(), true);
    pushRequired(missing, leadFields, "designation", "Designation", !form.designation?.trim(), false);
    pushRequired(missing, leadFields, "lead_source_id", "Lead Source", !form.lead_source_id, true);
    if (isMultiTierSource && !form.partner_names?.trim()) missing.push("Partner Names");
    if (isEventSource && !form.marketing_event_id) missing.push("Event");
    pushRequired(
      missing,
      leadFields,
      "sub_product_category",
      isCloudLeadProductType(form.product_type) ? "Sub Product" : "Sub Product Category",
      selectedSubProductCategories.length === 0,
      true,
    );
    if (!form.requirement_type) missing.push("Requirement Type");
    pushRequired(missing, leadFields, "purchase_model", "Purchase Model", !form.purchase_model, false);
    if (showHardwareSourcing && !(sourcingChannels.hardware && sourcingChannels.hardware.length > 0)) {
      missing.push("Hardware Sourcing Channel");
    }
    if (showServiceSourcing && !sourcingChannels.service?.trim()) {
      missing.push("Service Sourcing Channel");
    }
    pushRequired(
      missing,
      leadFields,
      "expected_amount",
      "Expected Order Value",
      form.expected_amount === undefined ||
      form.expected_amount === null ||
      Number.isNaN(Number(form.expected_amount)),
      true,
    );
    pushRequired(
      missing,
      leadFields,
      "expected_closure_date",
      "Expected Closure Date",
      !form.expected_closure_date?.trim(),
      true,
    );
    const saleType = resolveLeadSaleType(
      form.sale_type,
      form.end_customer_name,
      company?.customer_name,
    );
    if (!saleType) missing.push("Sale Type (Sell Through or Sell To)");
    if (saleType === "sell_through" && !form.end_customer_name?.trim()) {
      missing.push("End Customer Name");
    }
    if (!form.entity_name?.trim()) missing.push("Entity Name");
    if (!form.entity_address?.trim()) missing.push("Entity Address");
    if (!form.entity_contact?.trim()) missing.push("Entity Contact Number");
    if (!oemRows.some((row) => row.name.trim())) missing.push("OEM Name");
    for (const field of customFormFields(settings, "lead")) {
      if (!field.required) continue;
      if (isCustomFieldValueEmpty(customFields[field.key])) {
        missing.push(field.label || field.key);
      }
    }
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateFields(missing);
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { owner_employee_id: _owner, dr_number: _dr, new_dr_number: _newDr, ...leadBody } = form;
      const oemFields = formatOemPartnerFields(oemRows);
      const distributorFields = formatDistributorPartnerFields(distributorRows);
      const accountName = (company?.customer_name || "").trim();
      const resolvedSaleType = resolveLeadSaleType(
        form.sale_type,
        form.end_customer_name,
        accountName,
      );
      const endCustomerName =
        resolvedSaleType === "sell_to"
          ? accountName
          : (form.end_customer_name || "").trim();
      const payload = {
        ...leadBody,
        ...oemFields,
        ...distributorFields,
        assign_to_id: null,
        assigned_date: null,
        partner_names: isMultiTierSource ? form.partner_names?.trim() || null : null,
        marketing_event_id: isEventSource ? form.marketing_event_id || null : null,
        deal_type: formatLeadSourcingChannels(sourcingChannels, selectedProductTypes),
        expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
        committed_amount:
          isEdit && existingLead?.committed_amount != null
            ? Number(existingLead.committed_amount)
            : null,
        expected_closure_date: form.expected_closure_date || null,
        sale_type: resolvedSaleType || null,
        end_customer_name: endCustomerName || null,
        presales_owner_id: form.presales_owner_id?.trim() || null,
        requires_boq: Boolean(form.requires_boq) && !isCloudProduct,
        requires_sow: selectedProductTypes.includes("Services"),
        distributor_department: null,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
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
          currentStageLabel="New"
          onAction={async () => { }}
        />
      )}

      <CrmSection title="Lead Information" icon={UserPlus}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="DR Number">
            <Input
              value={
                isEdit
                  ? formatCrmCode(existingLead?.dr_number || existingLead?.lead_code || form.dr_number)
                  : formatCrmCode(nextDrNumber) || "Assigning…"
              }
              disabled
              aria-readonly="true"
              className="font-mono text-sm"
            />
          </FinanceField>
          <FinanceField label="Company">
            <Input value={company?.customer_name ?? ""} disabled aria-readonly="true" />
          </FinanceField>
          <FinanceField label="Project Title *" className="md:col-span-2">
            <Input value={form.project_title ?? ""} onChange={(e) => set("project_title", e.target.value)} />
          </FinanceField>

          <FinanceField label="First Name *">
            <Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
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
            <FinanceSelect
              value={form.lead_source_id}
              onChange={(e) => {
                const value = e.target.value;
                const nextSource = leadSources.find((source) => source.id === value);
                setForm((f) => ({
                  ...f,
                  lead_source_id: value,
                  partner_names: isMultiTierLeadSourceLabel(nextSource?.label)
                    ? f.partner_names
                    : "",
                  marketing_event_id: isEventLeadSourceLabel(nextSource?.label)
                    ? f.marketing_event_id
                    : "",
                }));
              }}
            >
              <option value="">None</option>
              {leadSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          {isMultiTierSource ? (
            <FinanceField label="Partner Names *">
              <Input
                value={form.partner_names ?? ""}
                onChange={(e) => set("partner_names", e.target.value)}
                placeholder="Enter partner company names"
              />
            </FinanceField>
          ) : null}
          {isEventSource ? (
            <FinanceField label="Event *">
              <FinanceSelect
                value={form.marketing_event_id ?? ""}
                onChange={(e) => set("marketing_event_id", e.target.value)}
              >
                <option value="">
                  {marketingEvents.length > 0 ? "None" : "No marketing events found"}
                </option>
                {marketingEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.label}
                  </option>
                ))}
              </FinanceSelect>
            </FinanceField>
          ) : null}

          <FinanceField label="Product Type *">
            <LeadProductTypeMultiSelect
              value={selectedProductTypes}
              onChange={onProductTypesChange}
              options={productTypeOptions}
            />
          </FinanceField>

          <FinanceField label={isCloudProduct ? "Sub Product *" : "Sub Product Category *"}>
            <LeadSubProductCategoryMultiSelect
              value={selectedSubProductCategories}
              options={subProductCategoryOptions}
              onChange={onSubProductCategoriesChange}
              disabled={selectedProductTypes.length === 0}
              emptyPlaceholder={
                selectedProductTypes.length > 0
                  ? isCloudProduct
                    ? "Select sub product(s)"
                    : "Select sub product categor(ies)"
                  : "Select product type first"
              }
            />
          </FinanceField>
          <FinanceField label="Requirement Type *">
            <FinanceSelect
              value={form.requirement_type ?? ""}
              onChange={(e) => set("requirement_type", e.target.value)}
            >
              <option value="">None</option>
              {requirementTypeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
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
              {purchaseModelOptions.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
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
              {engagementScoreOptions.map((score) => (
                <option key={score.value} value={Number(score.value)}>
                  {score.label.includes("%") ? score.label : `${score.label}%`}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          {showHardwareSourcing ? (
            <FinanceField label="Hardware Sourcing Channel *">
              <div
                role="group"
                aria-label="Hardware sourcing channels"
                className="flex flex-wrap gap-3 rounded-lg border border-input px-2.5 py-2"
              >
                {hardwareChannelOptions.map((channel) => {
                  const checked = (sourcingChannels.hardware ?? []).includes(channel);
                  return (
                    <label
                      key={channel}
                      className="inline-flex cursor-pointer items-center gap-2 text-sm transition-colors duration-150"
                    >
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        checked={checked}
                        onChange={() => toggleHardwareSourcingChannel(channel)}
                      />
                      {channel}
                    </label>
                  );
                })}
              </div>
            </FinanceField>
          ) : null}
          {showServiceSourcing ? (
            <FinanceField label="Service Sourcing Channel *">
              <FinanceSelect
                value={sourcingChannels.service ?? ""}
                onChange={(e) => setSourcingChannel("service", e.target.value)}
              >
                <option value="">None</option>
                {serviceChannelOptions.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </FinanceSelect>
            </FinanceField>
          ) : null}

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
                value={ownerDisplayLabel || "-"}
                disabled
                aria-readonly="true"
                title="Assigned from your logged-in user account"
              />
            )}
          </FinanceField>

          <FinanceField label="Presales Owner">
            <FinanceSelect
              value={form.presales_owner_id ?? ""}
              onChange={(e) => set("presales_owner_id", e.target.value)}
            >
              <option value="">None</option>
              {crmMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="Expected Order Value *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.expected_amount ?? ""}
              onChange={(e) => set("expected_amount", e.target.value ? Number(e.target.value) : undefined)}
            />
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
          <FinanceField label="GST Number">
            <Input
              value={companyGstin || "—"}
              disabled
              aria-readonly="true"
              className="font-mono text-sm"
            />
          </FinanceField>
        </div>
      </CrmSection>

      <LeadPartnerRowsTable
        title="OEM Information"
        icon={Package}
        nameLabel="OEM Name"
        rows={oemRows}
        nameOptions={oemNameOptions ?? LEAD_OEM_OPTIONS}
        onChange={onOemRowsChange}
        nameRequired
      />

      <LeadPartnerRowsTable
        title="Distributor Information"
        icon={Truck}
        nameLabel="Distributor Name"
        rows={distributorRows}
        nameOptions={distributorNameOptions}
        onChange={onDistributorRowsChange}
        allowCustomName
        companyId={company?.company_id}
        branchId={form.branch_id || company?.branch_id}
        onDistributorCreated={(name) => {
          setDistributorNameOptions((prev) =>
            prev.some((option) => option.toLowerCase() === name.toLowerCase())
              ? prev
              : [...prev, name],
          );
        }}
      />

      <CrmSection title="Sale Type" icon={Handshake}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Sale Type *" className="md:col-span-2">
            <div
              role="group"
              aria-label="Sale type"
              className="flex flex-wrap gap-4 rounded-lg border border-input px-2.5 py-2"
            >
              {(
                [
                  { value: "sell_through" as const, label: "Sell Through" },
                  { value: "sell_to" as const, label: "Sell To" },
                ] as const
              ).map((option) => {
                const checked = (form.sale_type || "") === option.value;
                return (
                  <label
                    key={option.value}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm transition-colors duration-150"
                  >
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={checked}
                      onChange={() => {
                        const accountName = (company?.customer_name || "").trim();
                        if (checked) {
                          setForm((prev) => ({
                            ...prev,
                            sale_type: "",
                            end_customer_name:
                              option.value === "sell_to" ? "" : prev.end_customer_name,
                          }));
                          return;
                        }
                        setForm((prev) => ({
                          ...prev,
                          sale_type: option.value,
                          end_customer_name:
                            option.value === "sell_to"
                              ? accountName
                              : option.value === "sell_through" &&
                                (prev.sale_type || "") === "sell_to"
                                ? ""
                                : prev.end_customer_name,
                        }));
                      }}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </FinanceField>
          {(form.sale_type || "") === "sell_through" ? (
            <FinanceField label="End Customer Name *">
              <Input
                value={form.end_customer_name ?? ""}
                onChange={(e) => set("end_customer_name", e.target.value)}
                placeholder="Enter end customer name"
              />
            </FinanceField>
          ) : null}
          {(form.sale_type || "") === "sell_to" ? (
            <FinanceField label="Account Name">
              <Input
                value={company?.customer_name ?? ""}
                disabled
                aria-readonly="true"
              />
            </FinanceField>
          ) : null}
        </div>
      </CrmSection>

      <CrmSection title="Cache Legal Entity" icon={Building2}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name *">
            <FinanceSelect
              value={entityPick}
              onChange={(e) => onEntityPickChange(e.target.value)}
              aria-label="Select own legal entity"
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

      <CrmCustomFieldsSection entity="lead" values={customFields} onChange={setCustomFields} />

      <CrmSection title="Lead Remarks" icon={MessageSquareText}>
        <FinanceField label="Remarks">
          <FinanceTextarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Add remarks for this lead"
            rows={4}
            className="min-h-[96px] cursor-text transition-colors duration-200"
            aria-label="Lead remarks"
          />
        </FinanceField>
      </CrmSection>

      <div className="flex justify-end gap-2">
        <Link
          href={`/crm/companies/${companyAccountId}`}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
        >
          Cancel
        </Link>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={saving || (isEdit && existingLead?.blueprint_state === "lost")}
          onClick={() => void onSave()}
        >
          {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create Lead"}
        </Button>
      </div>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        fields={mandateFields}
        onClose={() => {
          setMandateOpen(false);
          setMandateFields([]);
        }}
      />
    </CrmPage>
  );
}
