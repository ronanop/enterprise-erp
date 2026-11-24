"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, IndianRupee } from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { CrmCustomFieldsSection } from "@/components/crm/sales/crm-custom-fields-section";
import { CrmSessionEmployeeField } from "@/components/crm/sales/crm-session-employee-field";
import {
  OvfOrderLinesSection,
  buildAdditionalChargeVerticals,
  computeOvfMargins,
  customerRowsFromOvfLines,
  customerRowsFromQuoteLines,
  mergeCustomerRowsWithPoAttachments,
  mergeVendorRowsWithQuoteAttachments,
  persistOvfOrderLinesAfterCreate,
  persistOvfOrderLinesOnUpdate,
  sumLineTotals,
  validateChargeAttachments,
  vendorRowsFromOvfLines,
  vendorRowsFromQuoteLines,
  dedupeAttachmentsByFileName,
  supportingRowsFromOvfLines,
  serviceRowsFromOvfLines,
  type CustomerChargeRow,
  type SupportingItemRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import {
  FinanceField,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { extractCustomerPo } from "@/services/crm-deal-controls-service";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { formFieldsMap, pushRequired } from "@/lib/crm/crm-settings-ui";
import { loadCrmDistributorOptions } from "@/lib/crm/lead-distributor-options";
import { computeFinanceCostPct } from "@/lib/crm/ovf-finance-cost";
import { resolveSessionEmployeeLabel } from "@/lib/crm/session-employee";
import {
  addOvfLine,
  createAttachment,
  createOvf,
  fetchAttachmentContentBase64,
  fileToBase64,
  fullName,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getOvf,
  getQuote,
  getSalesLead,
  listAttachments,
  listContacts,
  listCrmMemberOptions,
  listMyJobs,
  listOvfLines,
  listOvfs,
  listQuoteLines,
  listQuotes,
  requestOvfFreight,
  requestOvfSupportingItems,
  updateOvf,
  updateOvfLine,
  type Attachment,
  type Opportunity,
  type Ovf,
  type Quote,
} from "@/services/sales-crm-service";

type OvfDraft = {
  po_number: string;
  po_date: string;
  delivery_period: string;
  customer_name: string;
  quote_name: string;
  billing_address: string;
  billing_state: string;
  billing_country: string;
  owner_name: string;
  billing_contact_person: string;
  shipping_address: string;
  shipping_state: string;
  shipping_country: string;
  shipping_contact_person: string;
  account_name: string;
  installation_details: string;
  technology_segment: string;
  sub_technology_segment: string;
  vendor_payment_days: string;
  customer_payment_days: string;
  freight: string;
  additional_charges: string;
  finance_cost_pct: string;
  approval_status: string;
  delivery_weeks_min: string;
  delivery_weeks_max: string;
  negotiated_by: string;
  negotiation_remark: string;
  early_payment_discount_pct: string;
  freight_medium: string;
  freight_weight_kg: string;
  freight_insurance: boolean;
};

function weeksFromDeliveryPeriod(value: string | null | undefined): [string, string] {
  const match = /(\d{1,3})\s*(?:(?:-|–|to)\s*(\d{1,3}))?\s*(?:weeks?|wks?|w)\b/i.exec(value ?? "");
  if (!match) return ["", ""];
  return [match[1], match[2] ?? match[1]];
}

function productTypeIncludesServices(productType: string | null | undefined): boolean {
  return (productType || "")
    .replace(/&/g, ",")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes("services");
}

/** Prefer opp.has_services; fall back to opp/lead product_type (legacy rows often lack the flag). */
function opportunityIncludesServices(
  opportunity: Opportunity | null,
  leadProductType?: string | null,
): boolean {
  if (!opportunity) return false;
  if (opportunity.has_services) return true;
  if (productTypeIncludesServices(opportunity.product_type)) return true;
  return productTypeIncludesServices(leadProductType);
}

const NUMBER_NO_SPIN =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

async function extractPoFieldsFromAttachments(
  opportunityId: string,
  attachments: Attachment[],
): Promise<{
  po_number: string | null;
  po_date: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  delivery_weeks_min: number | null;
  delivery_weeks_max: number | null;
  fields_found: string[];
} | null> {
  const poAtt = attachments.find((row) => row.category === "customer_po");
  if (!poAtt) return null;
  try {
    const { content_base64 } = await fetchAttachmentContentBase64(poAtt.id);
    return await extractCustomerPo(opportunityId, {
      file_name: poAtt.file_name,
      content_base64,
      capture_gst: false,
    });
  } catch {
    return null;
  }
}

async function distributorOptionsForOpportunity(opportunityRow: Opportunity): Promise<string[]> {
  if (!opportunityRow.lead_id) return loadCrmDistributorOptions(null);
  try {
    const lead = await getSalesLead(opportunityRow.lead_id);
    return loadCrmDistributorOptions(lead.distributor_name);
  } catch {
    return loadCrmDistributorOptions(null);
  }
}

export function OvfFormPage({ quoteId, ovfId }: { quoteId?: string; ovfId?: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const { settings } = useCrmSettingsEffective();
  const isEdit = Boolean(ovfId);
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [vendorNameOptions, setVendorNameOptions] = useState<string[]>([]);
  const [form, setForm] = useState<OvfDraft>({
    po_number: "",
    po_date: "",
    delivery_period: "",
    customer_name: "",
    quote_name: "",
    billing_address: "",
    billing_state: "",
    billing_country: "",
    owner_name: "",
    billing_contact_person: "",
    shipping_address: "",
    shipping_state: "",
    shipping_country: "",
    shipping_contact_person: "",
    account_name: "",
    installation_details: "",
    technology_segment: "",
    sub_technology_segment: "",
    vendor_payment_days: "",
    customer_payment_days: "",
    freight: "",
    additional_charges: "",
    finance_cost_pct: "",
    approval_status: "not_required",
    delivery_weeks_min: "",
    delivery_weeks_max: "",
    negotiated_by: "",
    negotiation_remark: "",
    early_payment_discount_pct: "",
    freight_medium: "road",
    freight_weight_kg: "",
    freight_insurance: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingFreight, setRequestingFreight] = useState(false);
  const [requestingSupporting, setRequestingSupporting] = useState(false);
  const [poReadNote, setPoReadNote] = useState<string | null>(null);
  const [freightPending, setFreightPending] = useState(false);
  const [supportingPending, setSupportingPending] = useState(false);
  const [supportingPricesPending, setSupportingPricesPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [customerRows, setCustomerRows] = useState<CustomerChargeRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorChargeRow[]>([]);
  const [supportingRows, setSupportingRows] = useState<SupportingItemRow[]>([]);
  const [serviceChargeTotal, setServiceChargeTotal] = useState(0);
  const [leadProductType, setLeadProductType] = useState<string | null>(null);
  const [marginInputsDirty, setMarginInputsDirty] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const showSupportingItems = opportunityIncludesServices(opportunity, leadProductType);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMarginInputsDirty(false);
    try {
      if (isEdit && ovfId) {
        const ovfRow = await getOvf(ovfId);
        if (ovfRow.locked) {
          throw new ApiClientError("This OVF is locked and cannot be edited.", 409);
        }
        if (ovfRow.blueprint_state !== "draft") {
          throw new ApiClientError(
            "OVF cannot be edited after it has been sent for approval.",
            409,
          );
        }
        if (ovfRow.deal_won || ovfRow.shared_to_scm) {
          throw new ApiClientError(
            "OVF cannot be edited after it is shared to SCM or marked Deal Won.",
            409,
          );
        }
        const [quoteRow, opportunityRow, ovfLines, quoteLines, attachments, opportunityAttachments] =
          await Promise.all([
            getQuote(ovfRow.quote_id),
            getOpportunity(ovfRow.opportunity_id),
            listOvfLines(ovfId).catch(() => []),
            listQuoteLines(ovfRow.quote_id).catch(() => []),
            listAttachments("ovf", ovfId).catch(() => []),
            listAttachments("opportunity", ovfRow.opportunity_id).catch(() => []),
          ]);
        const ovfPoAttachments = dedupeAttachmentsByFileName(
          attachments.filter((row) => row.category === "customer_po"),
        );
        const ovfQuoteAttachments = attachments.filter((row) => row.category === "vendor_quote");
        const poAttachments =
          ovfPoAttachments.length > 0
            ? ovfPoAttachments
            : dedupeAttachmentsByFileName(
              opportunityAttachments.filter((row) => row.category === "customer_po"),
            );
        const quoteAttachments =
          ovfQuoteAttachments.length > 0
            ? ovfQuoteAttachments
            : opportunityAttachments.filter(
              (row) => row.category === "oem_quote" || row.category === "vendor_quote",
            );
        const copyPriorPo = ovfPoAttachments.length === 0 && poAttachments.length > 0;
        const copyPriorQuote = ovfQuoteAttachments.length === 0 && quoteAttachments.length > 0;
        setOvf(ovfRow);
        setCustomFields((ovfRow.custom_fields as Record<string, unknown> | undefined) ?? {});
        setQuote(quoteRow);
        setOpportunity(opportunityRow);
        if (opportunityRow.lead_id) {
          const leadRow = await getSalesLead(opportunityRow.lead_id).catch(() => null);
          setLeadProductType(leadRow?.product_type ?? null);
        } else {
          setLeadProductType(null);
        }
        const pendingTasks = await listMyJobs({
          entity_type: "ovf",
          entity_id: ovfId,
          status: "pending",
        }).catch(() => []);
        setFreightPending(pendingTasks.some((task) => task.action === "provide_freight"));
        setSupportingPending(
          pendingTasks.some((task) => task.action === "provide_supporting_items"),
        );
        setSupportingPricesPending(
          pendingTasks.some((task) => task.action === "price_supporting_items"),
        );
        setVendorNameOptions(await distributorOptionsForOpportunity(opportunityRow));
        setCustomerRows(
          mergeCustomerRowsWithPoAttachments(
            customerRowsFromOvfLines(ovfLines, quoteLines),
            poAttachments,
            { copyOnSave: copyPriorPo },
          ),
        );
        setVendorRows(
          mergeVendorRowsWithQuoteAttachments(
            vendorRowsFromOvfLines(ovfLines, quoteLines),
            quoteAttachments,
            { copyOnSave: copyPriorQuote },
          ),
        );
        setSupportingRows(supportingRowsFromOvfLines(ovfLines));
        setServiceChargeTotal(sumLineTotals(serviceRowsFromOvfLines(ovfLines)));
        const extracted =
          !(ovfRow.po_number ?? "").trim()
            ? await extractPoFieldsFromAttachments(ovfRow.opportunity_id, opportunityAttachments)
            : null;
        setForm({
          po_number: ovfRow.po_number ?? extracted?.po_number ?? "",
          po_date: ovfRow.po_date
            ? String(ovfRow.po_date).slice(0, 10)
            : extracted?.po_date ?? "",
          delivery_period: ovfRow.delivery_period ?? "",
          customer_name: ovfRow.customer_name ?? "",
          quote_name: ovfRow.quote_name ?? "",
          billing_address: ovfRow.billing_address ?? extracted?.billing_address ?? "",
          billing_state: ovfRow.billing_state ?? "",
          billing_country: ovfRow.billing_country ?? "",
          owner_name: ovfRow.owner_name ?? "",
          billing_contact_person: ovfRow.billing_contact_person ?? "",
          shipping_address: ovfRow.shipping_address ?? extracted?.shipping_address ?? "",
          shipping_state: ovfRow.shipping_state ?? "",
          shipping_country: ovfRow.shipping_country ?? "",
          shipping_contact_person: ovfRow.shipping_contact_person ?? "",
          account_name: ovfRow.account_name ?? "",
          installation_details: ovfRow.installation_details ?? "",
          technology_segment: ovfRow.technology_segment ?? "",
          sub_technology_segment: ovfRow.sub_technology_segment ?? "",
          vendor_payment_days: String(ovfRow.vendor_payment_days ?? ""),
          customer_payment_days: String(ovfRow.customer_payment_days ?? ""),
          freight: String(ovfRow.freight ?? ""),
          additional_charges: String(ovfRow.additional_charges ?? ""),
          finance_cost_pct: String(ovfRow.finance_cost_pct ?? ""),
          approval_status: ovfRow.approval_status || "not_required",
          delivery_weeks_min:
            ovfRow.delivery_weeks_min != null
              ? String(ovfRow.delivery_weeks_min)
              : extracted?.delivery_weeks_min != null
                ? String(extracted.delivery_weeks_min)
                : weeksFromDeliveryPeriod(ovfRow.delivery_period)[0],
          delivery_weeks_max:
            ovfRow.delivery_weeks_max != null
              ? String(ovfRow.delivery_weeks_max)
              : extracted?.delivery_weeks_max != null
                ? String(extracted.delivery_weeks_max)
                : weeksFromDeliveryPeriod(ovfRow.delivery_period)[1],
          negotiated_by: ovfRow.negotiated_by ?? "",
          negotiation_remark: ovfRow.negotiation_remark ?? "",
          early_payment_discount_pct:
            ovfRow.early_payment_discount_pct ? String(ovfRow.early_payment_discount_pct) : "",
          freight_medium: ovfRow.freight_medium ?? "road",
          freight_weight_kg: ovfRow.freight_weight_kg != null ? String(ovfRow.freight_weight_kg) : "",
          freight_insurance: Boolean(ovfRow.freight_insurance),
        });
        if (extracted?.fields_found?.length) {
          setPoReadNote(
            `Filled from attached customer PO: ${extracted.fields_found.join(", ").replaceAll("_", " ")}.`,
          );
        }
        return;
      }

      if (!quoteId) {
        throw new ApiClientError("Quote is required to create an OVF.", 400);
      }

      const quoteRow = await getQuote(quoteId);
      const opportunityRow = await getOpportunity(quoteRow.opportunity_id);
      const [companyRow, contactRows, memberRows, blueprint, existingOvfs, opportunityAttachments, quoteAttachments] =
        await Promise.all([
          opportunityRow.company_account_id
            ? getCompany(opportunityRow.company_account_id).catch(() => null)
            : Promise.resolve(null),
          opportunityRow.company_account_id
            ? listContacts(opportunityRow.company_account_id).catch(() => [])
            : Promise.resolve([]),
          listCrmMemberOptions().catch(() => []),
          getOpportunityBlueprint(quoteRow.opportunity_id).catch(() => null),
          listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
          listAttachments("opportunity", quoteRow.opportunity_id).catch(() => []),
          listAttachments("quote", quoteId).catch(() => []),
        ]);
      if (quoteRow.quote_stage !== "accepted") {
        const siblingsPreview = await listQuotes({ opportunity_id: quoteRow.opportunity_id }).catch(
          () => [],
        );
        const parentIds = new Set(
          siblingsPreview.map((row) => row.parent_quote_id).filter((id): id is string => Boolean(id)),
        );
        const isSplitParent = siblingsPreview.some((row) => row.parent_quote_id === quoteRow.id);
        if (!isSplitParent || !siblingsPreview.some((row) => row.quote_stage === "accepted" && !parentIds.has(row.id))) {
          throw new ApiClientError("OVF can only be created from an accepted quote.", 409);
        }
      }
      if (!blueprint || blueprint.state !== "ovf_ready" || blueprint.locked) {
        throw new ApiClientError(
          `OVF can only be created when the opportunity is at OVF Ready (current: ${blueprint?.state ?? "unknown"}).`,
          409,
        );
      }
      if (existingOvfs.length > 0) {
        throw new ApiClientError(
          "An OVF already exists for this opportunity. Open that OVF to continue.",
          409,
        );
      }
      const siblingQuotes = await listQuotes({ opportunity_id: quoteRow.opportunity_id }).catch(
        () => [],
      );
      const parentIdsWithChildren = new Set(
        siblingQuotes.map((row) => row.parent_quote_id).filter((id): id is string => Boolean(id)),
      );
      const sourceQuotes = siblingQuotes
        .filter((row) => row.quote_stage === "accepted" && !parentIdsWithChildren.has(row.id))
        .sort((a, b) => a.quote_no.localeCompare(b.quote_no));
      if (sourceQuotes.length === 0) {
        throw new ApiClientError(
          "No accepted quote is available for OVF. Accept the quote (or its splits) first.",
          409,
        );
      }
      const selectedContact =
        contactRows.find((row) => row.id === quoteRow.contact_id) ??
        contactRows.find((row) => row.is_primary) ??
        contactRows[0] ??
        null;
      const ownerName =
        resolveSessionEmployeeLabel(memberRows, user) ||
        quoteRow.owner_name?.trim() ||
        memberRows.find((member) => member.id === opportunityRow.owner_employee_id)?.label ||
        "";
      const contactName = selectedContact ? fullName(selectedContact) : "";
      const billingAddress = companyRow
        ? [
          companyRow.billing_street,
          companyRow.billing_city,
          companyRow.billing_code,
        ]
          .filter(Boolean)
          .join(", ")
        : "";
      const shippingAddress = companyRow
        ? [
          companyRow.shipping_street,
          companyRow.shipping_city,
          companyRow.shipping_code,
        ]
          .filter(Boolean)
          .join(", ")
        : "";
      const priorCustomerPos = dedupeAttachmentsByFileName(
        opportunityAttachments.filter((row) => row.category === "customer_po"),
      );
      const vendorQuoteById = new Map(
        [
          ...opportunityAttachments.filter(
            (row) => row.category === "oem_quote" || row.category === "vendor_quote",
          ),
          ...quoteAttachments.filter(
            (row) => row.category === "vendor_quote" || row.category === "oem_quote",
          ),
        ].map((row) => [row.id, row]),
      );
      const splitSource =
        siblingQuotes.find((row) => parentIdsWithChildren.has(row.id)) ?? null;
      const displayQuote = splitSource ?? sourceQuotes[0] ?? quoteRow;
      const customerQuoteLines = splitSource
        ? await listQuoteLines(splitSource.id).catch(() => [])
        : await listQuoteLines(displayQuote.id).catch(() => []);
      const vendorQuoteRows = (
        await Promise.all(
          sourceQuotes.map(async (src) => {
            const lines = await listQuoteLines(src.id).catch(() => []);
            return vendorRowsFromQuoteLines(lines, src.quote_no);
          }),
        )
      ).flat();
      const priorVendorQuotes = [...vendorQuoteById.values()];
      setQuote(displayQuote);
      setOpportunity(opportunityRow);
      if (opportunityRow.lead_id) {
        const leadRow = await getSalesLead(opportunityRow.lead_id).catch(() => null);
        setLeadProductType(leadRow?.product_type ?? null);
      } else {
        setLeadProductType(null);
      }
      setVendorNameOptions(await distributorOptionsForOpportunity(opportunityRow));
      setCustomerRows(
        mergeCustomerRowsWithPoAttachments(
          customerRowsFromQuoteLines(customerQuoteLines),
          priorCustomerPos,
          { copyOnSave: true },
        ),
      );
      setVendorRows(
        mergeVendorRowsWithQuoteAttachments(vendorQuoteRows, priorVendorQuotes, {
          copyOnSave: true,
        }),
      );
      setSupportingRows([]);
      setFreightPending(false);
      setSupportingPending(false);
      setSupportingPricesPending(false);
      const extracted = await extractPoFieldsFromAttachments(
        quoteRow.opportunity_id,
        opportunityAttachments,
      );
      setForm((current) => ({
        ...current,
        customer_name: companyRow?.customer_name ?? displayQuote.entity_name ?? "",
        quote_name: displayQuote.subject ?? "",
        billing_address:
          (displayQuote.entity_address ?? billingAddress) || extracted?.billing_address || "",
        billing_state: companyRow?.billing_state ?? "",
        billing_country:
          displayQuote.billing_country ?? companyRow?.billing_country ?? "",
        owner_name: ownerName,
        billing_contact_person: contactName || displayQuote.entity_contact || "",
        shipping_address:
          shippingAddress || extracted?.shipping_address || "",
        shipping_state: companyRow?.shipping_state ?? "",
        shipping_country:
          displayQuote.shipping_country ?? companyRow?.shipping_country ?? "",
        shipping_contact_person: contactName || displayQuote.entity_contact || "",
        account_name: companyRow?.customer_name ?? displayQuote.entity_name ?? "",
        po_number: extracted?.po_number ?? current.po_number,
        po_date: extracted?.po_date ?? current.po_date,
        delivery_weeks_min:
          extracted?.delivery_weeks_min != null
            ? String(extracted.delivery_weeks_min)
            : current.delivery_weeks_min,
        delivery_weeks_max:
          extracted?.delivery_weeks_max != null
            ? String(extracted.delivery_weeks_max)
            : current.delivery_weeks_max,
      }));
      if (extracted?.fields_found?.length) {
        setPoReadNote(
          `Filled from attached customer PO: ${extracted.fields_found.join(", ").replaceAll("_", " ")}.`,
        );
      } else if (priorCustomerPos.length > 0) {
        setPoReadNote("Could not read PO number/date from the attached file — enter them manually.");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF details");
    } finally {
      setLoading(false);
    }
  }, [isEdit, ovfId, quoteId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<K extends keyof OvfDraft>(key: K, value: OvfDraft[K]) {
    if (
      key === "vendor_payment_days" ||
      key === "customer_payment_days" ||
      key === "additional_charges"
    ) {
      setMarginInputsDirty(true);
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onCustomerRowsChange(rows: CustomerChargeRow[]) {
    setMarginInputsDirty(true);
    setCustomerRows(rows);
  }

  function onVendorRowsChange(rows: VendorChargeRow[]) {
    setMarginInputsDirty(true);
    setVendorRows(rows);
  }

  const financeCostPct = useMemo(
    () =>
      computeFinanceCostPct(
        Number(form.vendor_payment_days) || 0,
        Number(form.customer_payment_days) || 0,
      ),
    [form.vendor_payment_days, form.customer_payment_days],
  );

  const supportingTotal = useMemo(
    () => supportingRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    [supportingRows],
  );
  const additionalChargesFromVerticals = supportingTotal + serviceChargeTotal;
  const additionalChargeRows = useMemo(
    () =>
      buildAdditionalChargeVerticals({
        supportingTotal,
        serviceVisitsTotal: serviceChargeTotal,
        recordedAdditional: Number(form.additional_charges) || 0,
      }),
    [supportingTotal, serviceChargeTotal, form.additional_charges],
  );

  // Supporting + service visit costs are Additional Charges (not vendor purchase).
  useEffect(() => {
    if (supportingRows.length === 0 && serviceChargeTotal <= 0) return;
    const next = additionalChargesFromVerticals.toFixed(2);
    setForm((current) => {
      if (current.additional_charges === next) return current;
      return { ...current, additional_charges: next };
    });
    setMarginInputsDirty(true);
  }, [supportingRows.length, supportingTotal, serviceChargeTotal, additionalChargesFromVerticals]);

  const margins = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: form.freight,
    financeCostPct,
  });
  const hasChargeVerticals = supportingRows.length > 0 || serviceChargeTotal > 0;
  const supportingDescriptionNote = useMemo(() => {
    for (const row of supportingRows) {
      const note = (row.description ?? "").trim();
      if (note) return note;
    }
    return "";
  }, [supportingRows]);
  const totalMarginAmount =
    margins.totalMarginAmount - (Number(form.additional_charges) || 0);
  const totalMarginPct = margins.totalSaleValue
    ? (totalMarginAmount / margins.totalSaleValue) * 100
    : 0;
  const marginAmountDisplay =
    marginInputsDirty && Number.isFinite(totalMarginAmount) ? totalMarginAmount.toFixed(2) : "";
  const marginPctDisplay =
    marginInputsDirty && Number.isFinite(totalMarginPct)
      ? Number(totalMarginPct.toFixed(10)).toString()
      : "";

  function ovfPayload() {
    const weeksMin = Number(form.delivery_weeks_min) || Number(form.delivery_weeks_max) || null;
    const weeksMax = Number(form.delivery_weeks_max) || Number(form.delivery_weeks_min) || null;
    return {
      po_number: form.po_number.trim(),
      po_date: form.po_date || null,
      delivery_period:
        weeksMax != null
          ? weeksMin === weeksMax
            ? `${weeksMax} weeks`
            : `${weeksMin}-${weeksMax} weeks`
          : null,
      delivery_weeks_min: weeksMin,
      delivery_weeks_max: weeksMax,
      negotiated_by: form.negotiated_by || null,
      negotiation_remark: form.negotiation_remark.trim() || null,
      early_payment_discount_pct: Number(form.early_payment_discount_pct) || 0,
      customer_name: form.customer_name.trim() || null,
      quote_name: form.quote_name.trim() || null,
      billing_address: form.billing_address.trim() || null,
      billing_state: form.billing_state.trim() || null,
      billing_country: form.billing_country.trim() || null,
      owner_name: form.owner_name.trim() || null,
      billing_contact_person: form.billing_contact_person.trim() || null,
      shipping_address: form.shipping_address.trim() || null,
      shipping_state: form.shipping_state.trim() || null,
      shipping_country: form.shipping_country.trim() || null,
      shipping_contact_person: form.shipping_contact_person.trim() || null,
      account_name: form.account_name.trim() || null,
      technology_segment: form.technology_segment.trim() || null,
      sub_technology_segment: form.sub_technology_segment.trim() || null,
      installation_details: form.installation_details.trim() || null,
      vendor_payment_days: Number(form.vendor_payment_days) || 0,
      customer_payment_days: Number(form.customer_payment_days) || 0,
      additional_charges: Number(Number(form.additional_charges || 0).toFixed(2)),
      total_margin_amount: Number(totalMarginAmount.toFixed(2)),
      total_margin_pct: Number(totalMarginPct.toFixed(10)),
      finance_cost_pct: Number(financeCostPct.toFixed(2)),
      custom_fields: customFields,
    };
  }

  async function ensureOvfTargetId(): Promise<string | null> {
    if (!quote || !opportunity) return null;
    let targetId = ovfId ?? ovf?.id ?? null;
    if (targetId) return targetId;
    try {
      const created = await createOvf({
        quote_id: quote.id,
        branch_id: opportunity.branch_id,
        ...ovfPayload(),
      });
      await persistOvfOrderLinesAfterCreate(
        created.id,
        created.branch_id,
        created.company_id ?? opportunity.company_account_id,
        customerRows,
        vendorRows,
        { listOvfLines, addOvfLine, updateOvfLine, createAttachment, fileToBase64 },
      ).catch(() => undefined);
      targetId = created.id;
      setOvf(created);
    } catch (createErr) {
      const existing = await listOvfs({ opportunity_id: opportunity.id }).catch(() => []);
      const found = existing.find((row) => row.quote_id === quote.id) ?? existing[0];
      if (!found) throw createErr;
      targetId = found.id;
      setOvf(found);
    }
    return targetId;
  }

  async function onAskScmFreight() {
    if (!quote || !opportunity || freightPending || requestingFreight || saving) return;
    setRequestingFreight(true);
    setError(null);
    try {
      const targetId = await ensureOvfTargetId();
      if (!targetId) return;

      const updated = await requestOvfFreight(targetId, {});
      setOvf(updated);
      setFreightPending(true);
      setForm((f) => ({
        ...f,
        freight: updated.freight != null ? String(updated.freight) : f.freight,
        approval_status: updated.approval_status ?? f.approval_status,
      }));

      if (!ovfId) {
        router.replace(`/crm/ovf/${targetId}/edit`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to request freight from SCM");
    } finally {
      setRequestingFreight(false);
    }
  }

  async function onAskOpsSupportingItems() {
    if (!quote || !opportunity || supportingPending || requestingSupporting || saving) return;
    setRequestingSupporting(true);
    setError(null);
    try {
      const targetId = await ensureOvfTargetId();
      if (!targetId) return;

      const updated = await requestOvfSupportingItems(targetId, {});
      setOvf(updated);
      setSupportingPending(true);

      if (!ovfId) {
        router.replace(`/crm/ovf/${targetId}/edit`);
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to request supporting items from Operations",
      );
    } finally {
      setRequestingSupporting(false);
    }
  }

  async function onSave() {
    if (!quote || !opportunity) return;
    const missing: string[] = [];
    const ovfFields = formFieldsMap(settings, "ovf");
    pushRequired(missing, ovfFields, "po_number", "PO Number", !form.po_number.trim(), true);
    if (!form.shipping_address.trim()) missing.push("Shipping Address");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    const chargeError = validateChargeAttachments(customerRows, vendorRows);
    if (chargeError) {
      setError(chargeError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && ovfId) {
        const payload = ovfPayload();
        const saved = await updateOvf(ovfId, payload);
        await persistOvfOrderLinesOnUpdate(
          saved.id,
          saved.branch_id,
          saved.company_id ?? opportunity.company_account_id,
          customerRows,
          vendorRows,
          { addOvfLine, updateOvfLine, createAttachment, fileToBase64 },
        );
        await updateOvf(saved.id, {
          additional_charges: payload.additional_charges,
          total_margin_amount: payload.total_margin_amount,
          total_margin_pct: payload.total_margin_pct,
          finance_cost_pct: payload.finance_cost_pct,
        });
        router.push(`/crm/ovf/${saved.id}`);
        return;
      }

      const created = await createOvf({
        quote_id: quote.id,
        branch_id: opportunity.branch_id,
        ...ovfPayload(),
      });
      await persistOvfOrderLinesAfterCreate(
        created.id,
        created.branch_id,
        created.company_id ?? opportunity.company_account_id,
        customerRows,
        vendorRows,
        { listOvfLines, addOvfLine, updateOvfLine, createAttachment, fileToBase64 },
      );
      router.push(`/crm/ovf/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : isEdit ? "Failed to update OVF" : "Failed to create OVF");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/60" />;
  }

  const backHref = isEdit && ovfId
    ? `/crm/ovf/${ovfId}`
    : `/crm/opportunities/${opportunity?.id ?? ""}`;
  const backLabel = isEdit ? ovf?.ovf_no ?? "OVF" : "Opportunity";

  return (
    <CrmPage>
      <Link
        href={backHref}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> {backLabel}
      </Link>
      <PageHeader
        title={isEdit ? `Edit ${ovf?.ovf_no ?? "OVF"}` : "Create OVF Module"}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={backHref}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            >
              Cancel
            </Link>
            <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save"}
            </Button>
          </div>
        }
      />
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="OVF Module Information" icon={ClipboardCheck}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Customer Name"><Input value={form.customer_name} onChange={(event) => setField("customer_name", event.target.value)} /></FinanceField>
          <FinanceField label="Quote Name"><Input value={form.quote_name} onChange={(event) => setField("quote_name", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Address"><Input value={form.billing_address} onChange={(event) => setField("billing_address", event.target.value)} /></FinanceField>
          <FinanceField label="Quote No"><Input value={quote?.quote_no ?? "-"} disabled /></FinanceField>
          <FinanceField label="Billing State"><Input value={form.billing_state} onChange={(event) => setField("billing_state", event.target.value)} /></FinanceField>
          <CrmSessionEmployeeField label="OVF Module Owner" value={form.owner_name} />
          <FinanceField label="Billing Contact Person"><Input value={form.billing_contact_person} onChange={(event) => setField("billing_contact_person", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Address *"><Input value={form.shipping_address} onChange={(event) => setField("shipping_address", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Country"><Input value={form.billing_country} onChange={(event) => setField("billing_country", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping State"><Input value={form.shipping_state} onChange={(event) => setField("shipping_state", event.target.value)} /></FinanceField>
          <FinanceField label="PO Number *">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Input value={form.po_number} onChange={(event) => setField("po_number", event.target.value)} />
              {poReadNote ? <p className="text-[11px] text-muted-foreground">{poReadNote}</p> : null}
            </div>
          </FinanceField>
          <FinanceField label="Customer PO Date">
            <Input type="date" value={form.po_date} onChange={(event) => setField("po_date", event.target.value)} />
          </FinanceField>
          <FinanceField label="Shipping Contact Person">
            <Input value={form.shipping_contact_person} onChange={(event) => setField("shipping_contact_person", event.target.value)} />
          </FinanceField>
          <FinanceField label="Shipping Country">
            <Input value={form.shipping_country} onChange={(event) => setField("shipping_country", event.target.value)} />
          </FinanceField>
          <FinanceField label="OVF sent to SCM team">
            <Input value={ovf?.shared_to_scm ? "Yes" : "No"} disabled />
          </FinanceField>
          <FinanceField label="Installation/Service Details">
            <FinanceTextarea value={form.installation_details} onChange={(event) => setField("installation_details", event.target.value)} />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Charges and Details" icon={IndianRupee}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Total Margin in Amount">
            <Input
              type="text"
              readOnly
              className={`${NUMBER_NO_SPIN} cursor-default bg-muted/50`}
              value={marginAmountDisplay}
              placeholder="-"
              title="Customer - Vendor - Freight - Additional charges - Finance cost + Early-payment saving"
            />
          </FinanceField>
          <FinanceField label="Vendor Payments Terms">
            <Input
              type="number"
              min={0}
              className={NUMBER_NO_SPIN}
              value={form.vendor_payment_days}
              onChange={(event) => setField("vendor_payment_days", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Total Margin in Percentage">
            <Input
              type="text"
              readOnly
              className={`${NUMBER_NO_SPIN} cursor-default bg-muted/50`}
              value={marginPctDisplay}
              placeholder="-"
              title="Total Margin Amount ÷ Customer Total × 100"
            />
          </FinanceField>
          <FinanceField label="Customer Payment Term">
            <Input
              type="number"
              min={0}
              className={NUMBER_NO_SPIN}
              value={form.customer_payment_days}
              onChange={(event) => setField("customer_payment_days", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Freight Charges (₹)">
            <div className="flex min-w-0 flex-col gap-2">
              <Input
                type="text"
                readOnly
                aria-readonly="true"
                className="cursor-default bg-muted/50"
                value={
                  form.freight.trim()
                    ? Number(form.freight).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                    : "—"
                }
              />
              {freightPending ? (
                <p className="text-xs text-muted-foreground">
                  Waiting on SCM to enter freight in My Jobs.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit cursor-pointer"
                  disabled={requestingFreight || saving || !quote || !opportunity}
                  onClick={() => void onAskScmFreight()}
                >
                  {requestingFreight ? "Requesting…" : "Ask SCM for freight"}
                </Button>
              )}
            </div>
          </FinanceField>
          <FinanceField label="Finance Cost (%)">
            <Input
              type="text"
              readOnly
              className={`${NUMBER_NO_SPIN} cursor-default bg-muted/50`}
              value={financeCostPct.toFixed(2)}
              title="IF(customer > vendor, 0.5%/15 × (customer − vendor), 0) (2 d.p.)"
            />
          </FinanceField>
          <FinanceField label="Additional Charges (₹)">
            <Input
              type={hasChargeVerticals ? "text" : "number"}
              readOnly={hasChargeVerticals}
              aria-readonly={hasChargeVerticals ? "true" : undefined}
              min={hasChargeVerticals ? undefined : 0}
              step={hasChargeVerticals ? undefined : "0.01"}
              className={
                hasChargeVerticals
                  ? `${NUMBER_NO_SPIN} cursor-default bg-muted/50`
                  : NUMBER_NO_SPIN
              }
              value={
                hasChargeVerticals
                  ? additionalChargesFromVerticals.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                  : form.additional_charges
              }
              onChange={(event) => setField("additional_charges", event.target.value)}
              title={
                hasChargeVerticals
                  ? "Sum of supporting items and service visits (outside Vendor PO)"
                  : undefined
              }
            />
          </FinanceField>
        </div>
      </CrmSection>

      <OvfOrderLinesSection
        customerRows={customerRows}
        vendorRows={vendorRows}
        onCustomerRowsChange={onCustomerRowsChange}
        onVendorRowsChange={onVendorRowsChange}
        vendorNameOptions={vendorNameOptions}
        supportingRows={showSupportingItems ? supportingRows : undefined}
        supportingDescription={
          showSupportingItems ? supportingDescriptionNote : undefined
        }
        supportingHeaderRight={
          showSupportingItems ? (
            supportingPending ? (
              <p className="text-xs text-muted-foreground">
                Waiting on Operations to enter items in My Jobs.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit cursor-pointer"
                disabled={requestingSupporting || saving || !quote || !opportunity}
                onClick={() => void onAskOpsSupportingItems()}
              >
                {requestingSupporting ? "Requesting…" : "Ask Operations for supporting items"}
              </Button>
            )
          ) : undefined
        }
        supportingAwaitingScmPrices={
          showSupportingItems &&
          supportingRows.length > 0 &&
          (supportingPricesPending ||
            supportingRows.every((row) => (Number(row.unit_price) || 0) <= 0))
        }
        additionalChargeRows={additionalChargeRows}
        readOnlyLines
        disabled={saving}
      />

      <CrmCustomFieldsSection entity="ovf" values={customFields} onChange={setCustomFields} />

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
