"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FileInput, FileText, ListOrdered, MapPin, Plus, Scale, Trash2 } from "lucide-react";

import { CrmErrorBanner, CrmIconBadge, CrmListPanel, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { CrmCustomFieldsSection } from "@/components/crm/sales/crm-custom-fields-section";
import { CrmSessionEmployeeField } from "@/components/crm/sales/crm-session-employee-field";
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
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { quoteServiceTypeOptions } from "@/services/crm-settings-service";
import { formFieldsMap, pushRequired } from "@/lib/crm/crm-settings-ui";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import {
  resolveSessionEmployeeLabel,
  stripEmployeeCodeSuffix,
} from "@/lib/crm/session-employee";
import {
  normalizeQuoteServiceType,
  parseLeadProductTypes,
  parseLeadSubProductCategories,
} from "@/lib/crm/lead-product-options";
import { ApiClientError } from "@/services/api-client";
import { extractVendorQuoteLines, getDefaultQuoteTerms } from "@/services/crm-deal-controls-service";
import {
  addQuoteLine,
  createAttachment,
  createContact,
  createQuote,
  deleteQuoteLine,
  fileToBase64,
  formatInrPrecise,
  fullName,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getQuote,
  getSalesLead,
  listContacts,
  listCrmMemberOptions,
  listQuoteLines,
  formatMarginPctInput,
  peekNextQuoteNumber,
  quoteLineMarkupPct,
  updateQuote,
  updateQuoteLine,
  type Company,
  type Contact,
  type Opportunity,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

type QuoteDraft = {
  project_title: string;
  account_name: string;
  contact_id: string;
  service_type: string;
  owner_name: string;
  subject: string;
  valid_until: string;
  entity_name: string;
  entity_email: string;
  entity_address: string;
  entity_gst: string;
  entity_contact: string;
  amc_warranty: string;
  amc_start_date: string;
  amc_end_date: string;
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  billing_country: string;
  shipping_street: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country: string;
  description: string;
  reason_for_discount: string;
  terms: string;
  freight: string;
};

type LineDraft = {
  key: string;
  serverId?: string;
  product_name: string;
  hsn_sac: string;
  description: string;
  sub_product_category: string;
  line_type: string;
  qty: string;
  unit_cost: string;
  unit_sell: string;
  margin_pct: string;
  gst_pct: string;
  vendorFile: File | null;
};

const EMPTY_FORM: QuoteDraft = {
  project_title: "",
  account_name: "",
  contact_id: "",
  service_type: "",
  owner_name: "",
  subject: "",
  valid_until: "",
  entity_name: "",
  entity_email: "",
  entity_address: "",
  entity_gst: "",
  entity_contact: "",
  amc_warranty: "none",
  amc_start_date: "",
  amc_end_date: "",
  billing_street: "",
  billing_city: "",
  billing_state: "",
  billing_zip: "",
  billing_country: "",
  shipping_street: "",
  shipping_city: "",
  shipping_state: "",
  shipping_zip: "",
  shipping_country: "",
  description: "",
  reason_for_discount: "",
  terms: "",
  freight: "0",
};

function newLine(lineType: string = "hardware"): LineDraft {
  return {
    key: crypto.randomUUID(),
    product_name: "",
    hsn_sac: "",
    description: "",
    sub_product_category: "",
    line_type: lineType,
    qty: "1",
    unit_cost: "0",
    unit_sell: "0",
    margin_pct: "0",
    gst_pct: "18",
    vendorFile: null,
  };
}

function isServiceLine(line: LineDraft): boolean {
  return (line.line_type || "").trim().toLowerCase() === "services";
}

function namesMatch(
  left: { first_name?: string | null; last_name?: string | null },
  right: { first_name?: string | null; last_name?: string | null },
): boolean {
  const a = fullName(left).trim().toLowerCase();
  const b = fullName(right).trim().toLowerCase();
  return Boolean(a && b && a !== "-" && a === b);
}

/** Prefer the lead/company person (e.g. "Moksh Sharma") as quote Contact Name. */
async function resolveQuoteContact(input: {
  opportunity: Opportunity;
  company: Company | null;
  lead: SalesLead | null;
  contacts: Contact[];
}): Promise<{ contacts: Contact[]; contactId: string }> {
  const preferred = {
    first_name: (input.lead?.first_name || input.company?.first_name || "").trim(),
    last_name: (input.lead?.last_name || input.company?.last_name || "").trim() || null,
    email: input.lead?.email || input.company?.customer_email || null,
    mobile: input.lead?.mobile || input.company?.phone || null,
    title: input.lead?.designation || input.company?.role || null,
  };

  let contacts = [...input.contacts];
  let match =
    preferred.first_name
      ? contacts.find((contact) => namesMatch(contact, preferred))
      : undefined;
  if (!match) {
    match = contacts.find((contact) => contact.is_primary) ?? contacts[0];
  }

  if (
    !match &&
    preferred.first_name &&
    input.opportunity.company_account_id &&
    input.opportunity.branch_id
  ) {
    try {
      const created = await createContact({
        company_account_id: input.opportunity.company_account_id,
        branch_id: input.opportunity.branch_id,
        first_name: preferred.first_name,
        last_name: preferred.last_name,
        email: preferred.email,
        mobile: preferred.mobile,
        phone: preferred.mobile,
        title: preferred.title,
        is_primary: contacts.length === 0,
      });
      contacts = [created, ...contacts];
      match = created;
    } catch {
      // Keep the dropdown empty if contact sync fails; user can still pick/create later.
    }
  }

  return { contacts, contactId: match?.id ?? "" };
}

const LINE_TABLE_HEADERS = [
  "S.No",
  "Sub Product Type",
  "Product Name",
  "HSN/SAC Code",
  "Item Description",
  "Quantity",
  "Unit Price (₹)",
  "Margin %",
  "Unit Margin Value (₹)",
  "Unit Price Margin (₹)",
  "Total Margin Value (₹)",
  "Total Qty Price Margin (₹)",
  "GST %",
  "Total GST",
  "Total Amount incl. GST",
  "",
] as const;

const SERVICE_LINE_TABLE_HEADERS = LINE_TABLE_HEADERS.filter(
  (label) => label !== "Sub Product Type",
);

export function QuoteFormPage({
  opportunityId,
  quoteId,
}: {
  opportunityId?: string;
  quoteId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(quoteId);
  const { user } = useAuthUser();
  const { settings } = useCrmSettingsEffective();
  const quoteFields = useMemo(() => formFieldsMap(settings, "quote"), [settings]);
  const serviceTypeOptions = useMemo(() => quoteServiceTypeOptions(settings), [settings]);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<QuoteDraft>(EMPTY_FORM);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [initialLineIds, setInitialLineIds] = useState<string[]>([]);
  const [copyAddressAction, setCopyAddressAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [nextQuoteNo, setNextQuoteNo] = useState("");
  const vendorImportRef = useRef<HTMLInputElement>(null);
  const [importingVendor, setImportingVendor] = useState(false);
  const [vendorImportNote, setVendorImportNote] = useState<string | null>(null);
  const [leadProductType, setLeadProductType] = useState<string | null>(null);
  const [leadSubProductCategories, setLeadSubProductCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isEdit && quoteId) {
        const quoteRow = await getQuote(quoteId);
        if (quoteRow.locked) {
          throw new ApiClientError("This quote is locked and cannot be edited.", 409);
        }
        if (quoteRow.quote_stage === "accepted" || quoteRow.quote_stage === "lost") {
          throw new ApiClientError("Accepted or lost quotes cannot be edited.", 409);
        }
        const [opportunityRow, lineRows, contactRows, employeeRows] = await Promise.all([
          getOpportunity(quoteRow.opportunity_id),
          listQuoteLines(quoteId).catch(() => []),
          quoteRow.company_account_id
            ? listContacts(quoteRow.company_account_id).catch(() => [])
            : Promise.resolve([]),
          listCrmMemberOptions().catch(() => []),
        ]);
        const leadRow = opportunityRow.lead_id
          ? await getSalesLead(opportunityRow.lead_id).catch(() => null)
          : null;
        setQuote(quoteRow);
        setCustomFields((quoteRow.custom_fields as Record<string, unknown> | undefined) ?? {});
        setOpportunity(opportunityRow);
        setLeadProductType(leadRow?.product_type ?? opportunityRow.product_type ?? null);
        setLeadSubProductCategories(
          parseLeadSubProductCategories(leadRow?.sub_product_category),
        );
        setContacts(contactRows);
        setForm({
          project_title: quoteRow.project_title ?? "",
          account_name: quoteRow.account_name ?? "",
          contact_id: quoteRow.contact_id ?? "",
          service_type: normalizeQuoteServiceType(quoteRow.service_type, serviceTypeOptions),
          owner_name: stripEmployeeCodeSuffix(quoteRow.owner_name ?? ""),
          subject: quoteRow.subject ?? "",
          valid_until: quoteRow.valid_until ?? "",
          entity_name: quoteRow.entity_name ?? "",
          entity_email: quoteRow.entity_email ?? "",
          entity_address: quoteRow.entity_address ?? "",
          entity_gst: quoteRow.entity_gst ?? "",
          entity_contact: quoteRow.entity_contact ?? "",
          amc_warranty: quoteRow.amc_warranty ?? "none",
          amc_start_date: quoteRow.amc_start_date ?? "",
          amc_end_date: quoteRow.amc_end_date ?? "",
          billing_street: quoteRow.billing_street ?? "",
          billing_city: quoteRow.billing_city ?? "",
          billing_state: quoteRow.billing_state ?? "",
          billing_zip: quoteRow.billing_zip ?? "",
          billing_country: quoteRow.billing_country ?? "",
          shipping_street: quoteRow.shipping_street ?? "",
          shipping_city: quoteRow.shipping_city ?? "",
          shipping_state: quoteRow.shipping_state ?? "",
          shipping_zip: quoteRow.shipping_zip ?? "",
          shipping_country: quoteRow.shipping_country ?? "",
          description: quoteRow.description ?? "",
          reason_for_discount: quoteRow.reason_for_discount ?? "",
          terms: quoteRow.terms ?? "",
          freight: String(quoteRow.freight ?? 0),
        });
        const mappedLines =
          lineRows.length > 0
            ? lineRows.map((line) => ({
              key: line.id,
              serverId: line.id,
              product_name: line.product_name,
              hsn_sac: line.hsn_sac ?? "",
              description: line.description ?? "",
              sub_product_category: line.sub_product_category ?? "",
              line_type: line.line_type || "hardware",
              qty: String(line.qty ?? 1),
              unit_cost: String(line.unit_cost ?? 0),
              unit_sell: String(line.unit_cost ?? 0),
              margin_pct: formatMarginPctInput(
                line.margin_pct != null && Number(line.margin_pct) !== 0
                  ? line.margin_pct
                  : quoteLineMarkupPct(line.unit_cost, line.unit_sell, line.margin_pct),
              ),
              gst_pct: String(line.gst_pct ?? 0),
              vendorFile: null,
            }))
            : [newLine()];
        setLines(mappedLines);
        setInitialLineIds(lineRows.map((line) => line.id));
        return;
      }

      if (!opportunityId) {
        throw new ApiClientError("Opportunity is required to create a quote.", 400);
      }

      const opportunityRow = await getOpportunity(opportunityId);
      const [companyRow, leadRow, contactRows, employeeRows, blueprint, previewQuoteNo] =
        await Promise.all([
          opportunityRow.company_account_id
            ? getCompany(opportunityRow.company_account_id).catch(() => null)
            : Promise.resolve(null),
          opportunityRow.lead_id
            ? getSalesLead(opportunityRow.lead_id).catch(() => null)
            : Promise.resolve(null),
          opportunityRow.company_account_id
            ? listContacts(opportunityRow.company_account_id).catch(() => [])
            : Promise.resolve([]),
          listCrmMemberOptions().catch(() => []),
          getOpportunityBlueprint(opportunityId).catch(() => null),
          peekNextQuoteNumber(opportunityId).catch(() => ""),
        ]);
      setNextQuoteNo(previewQuoteNo);
      if (
        !blueprint?.is_sales_blueprint ||
        !["quote_ready", "quote_in_progress"].includes(blueprint.state) ||
        blueprint.locked
      ) {
        throw new ApiClientError(
          `Quotes can only be created when the opportunity is at Quote Ready (current: ${blueprint?.state ?? "unknown"}).`,
          409,
        );
      }
      setOpportunity(opportunityRow);
      const productTypeSource = leadRow?.product_type ?? opportunityRow.product_type ?? null;
      setLeadProductType(productTypeSource);
      const leadSubCats = parseLeadSubProductCategories(leadRow?.sub_product_category);
      setLeadSubProductCategories(leadSubCats);
      const resolvedContact = await resolveQuoteContact({
        opportunity: opportunityRow,
        company: companyRow,
        lead: leadRow,
        contacts: contactRows,
      });
      setContacts(resolvedContact.contacts);

      const billingAddress = companyRow
        ? [
          companyRow.billing_street,
          companyRow.billing_city,
          companyRow.billing_state,
          companyRow.billing_code,
          companyRow.billing_country,
        ]
          .filter(Boolean)
          .join(", ")
        : "";
      const ownerLabel =
        resolveSessionEmployeeLabel(employeeRows, user) ||
        stripEmployeeCodeSuffix(
          employeeRows.find((employee) => employee.id === opportunityRow.owner_employee_id)?.label ||
          "",
        );
      setForm({
        project_title: opportunityRow.project_title || opportunityRow.opportunity_name || "",
        account_name: companyRow?.customer_name ?? "",
        contact_id: resolvedContact.contactId,
        service_type:
          normalizeQuoteServiceType(
            leadRow?.product_type ?? opportunityRow.product_type,
            serviceTypeOptions,
          ) ||
          "",
        owner_name: ownerLabel,
        subject: opportunityRow.opportunity_name || "",
        valid_until: "",
        entity_name: leadRow?.entity_name || companyRow?.customer_name || "",
        entity_email: leadRow?.entity_email || companyRow?.customer_email || "",
        entity_address: leadRow?.entity_address || billingAddress,
        entity_gst: leadRow?.entity_gst || "",
        entity_contact: leadRow?.entity_contact || companyRow?.phone || "",
        amc_warranty: "none",
        amc_start_date: "",
        amc_end_date: "",
        billing_street: leadRow?.street || companyRow?.billing_street || "",
        billing_city: leadRow?.city || companyRow?.billing_city || "",
        billing_state: leadRow?.state || companyRow?.billing_state || "",
        billing_zip: leadRow?.zip || companyRow?.billing_code || "",
        billing_country: leadRow?.country || companyRow?.billing_country || "",
        shipping_street: companyRow?.shipping_street || "",
        shipping_city: companyRow?.shipping_city || "",
        shipping_state: companyRow?.shipping_state || "",
        shipping_zip: companyRow?.shipping_code || "",
        shipping_country: companyRow?.shipping_country || companyRow?.billing_country || "",
        description: leadRow?.notes || companyRow?.description || "",
        reason_for_discount: "",
        terms: await getDefaultQuoteTerms().catch(() => ""),
        freight: "0",
      });
      const selectedTypes = parseLeadProductTypes(productTypeSource);
      const wantsServices =
        Boolean(opportunityRow.has_services) || selectedTypes.includes("Services");
      const wantsProducts =
        selectedTypes.length === 0 || selectedTypes.some((type) => type !== "Services");
      const defaultSub =
        leadSubCats.length === 1 ? leadSubCats[0] : "";
      const starter: LineDraft[] = [];
      if (wantsProducts) {
        starter.push({ ...newLine("hardware"), sub_product_category: defaultSub });
      }
      if (wantsServices) {
        starter.push({ ...newLine("services"), sub_product_category: defaultSub });
      }
      setLines(
        starter.length > 0
          ? starter
          : [{ ...newLine("hardware"), sub_product_category: defaultSub }],
      );
      setInitialLineIds([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load quote details");
    } finally {
      setLoading(false);
    }
  }, [isEdit, opportunityId, quoteId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function copyAddress(direction: "billing_to_shipping" | "shipping_to_billing") {
    setForm((current) =>
      direction === "billing_to_shipping"
        ? {
          ...current,
          shipping_street: current.billing_street,
          shipping_city: current.billing_city,
          shipping_state: current.billing_state,
          shipping_zip: current.billing_zip,
          shipping_country: current.billing_country,
        }
        : {
          ...current,
          billing_street: current.shipping_street,
          billing_city: current.shipping_city,
          billing_state: current.shipping_state,
          billing_zip: current.shipping_zip,
          billing_country: current.shipping_country,
        },
    );
  }

  function onCopyAddressChange(value: string) {
    if (value === "billing_to_shipping" || value === "shipping_to_billing") {
      copyAddress(value);
    }
    setCopyAddressAction("");
  }

  async function importVendorQuote(file: File | undefined) {
    if (vendorImportRef.current) vendorImportRef.current.value = "";
    if (!file) return;
    setImportingVendor(true);
    setVendorImportNote(null);
    try {
      const result = await extractVendorQuoteLines(file.name, await fileToBase64(file));
      if (result.lines.length === 0) {
        setVendorImportNote(
          result.text_extracted
            ? `No item rows found in ${file.name} - rows need a quantity, rate and amount. Add the lines manually.`
            : result.ocr_available
              ? `Could not read any text from ${file.name}. Try a clearer scan or the vendor's PDF.`
              : `${file.name} looks scanned and OCR is not installed on the server. Upload a text PDF or Excel.`,
        );
        return;
      }
      const imported = result.lines.map((row, index): LineDraft => {
        const cost = String(Number(row.unit_cost));
        return {
          ...newLine("hardware"),
          product_name: row.product_name,
          hsn_sac: row.hsn_sac ?? "",
          qty: String(Number(row.qty)),
          unit_cost: cost,
          unit_sell: cost,
          gst_pct: row.gst_pct != null ? String(Number(row.gst_pct)) : "18",
          vendorFile: index === 0 ? file : null,
        };
      });
      setLines((current) => [
        ...current.filter(
          (line) =>
            isServiceLine(line) || line.serverId || line.product_name.trim(),
        ),
        ...imported,
      ]);
      setVendorImportNote(
        `Added ${imported.length} line(s) from ${file.name} at vendor cost - set the margin % on each. The quote file is attached to the first line.`,
      );
    } catch (err) {
      setVendorImportNote(err instanceof ApiClientError ? err.message : "Could not read the vendor quote.");
    } finally {
      setImportingVendor(false);
    }
  }

  function setLine(key: string, field: keyof Omit<LineDraft, "key">, value: string | File | null) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  }

  const productTypes = useMemo(
    () => parseLeadProductTypes(leadProductType ?? opportunity?.product_type),
    [leadProductType, opportunity?.product_type],
  );
  const showServicesTable = useMemo(() => {
    if (opportunity?.has_services) return true;
    if (productTypes.includes("Services")) return true;
    return lines.some(isServiceLine);
  }, [opportunity?.has_services, productTypes, lines]);
  const showProductsTable = useMemo(() => {
    if (productTypes.length === 0) return true;
    if (productTypes.some((type) => type !== "Services")) return true;
    return lines.some((line) => !isServiceLine(line));
  }, [productTypes, lines]);
  const productLines = useMemo(() => lines.filter((line) => !isServiceLine(line)), [lines]);
  const serviceLines = useMemo(() => lines.filter(isServiceLine), [lines]);

  const totals = useMemo(() => {
    const rows = lines.map((line) => {
      const qty = Number(line.qty) || 0;
      const unitPrice = Number(line.unit_sell) || 0;
      const marginPct = Number(line.margin_pct) || 0;
      const gstPct = Number(line.gst_pct) || 0;
      // Markup on unit price: margin value = price × margin%
      const unitMarginValue = (unitPrice * marginPct) / 100;
      const unitPriceMargin = unitPrice + unitMarginValue;
      const totalMarginValue = qty * unitMarginValue;
      const totalQtyPriceMargin = qty * unitPriceMargin;
      const gstAmount = (totalQtyPriceMargin * gstPct) / 100;
      return {
        key: line.key,
        unitMarginValue,
        unitPriceMargin,
        totalMarginValue,
        totalQtyPriceMargin,
        marginAmount: totalMarginValue,
        marginPct,
        gstAmount,
        withGst: totalQtyPriceMargin + gstAmount,
        sellTotal: totalQtyPriceMargin,
      };
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    const sellTotal = rows.reduce((sum, row) => sum + row.sellTotal, 0);
    const marginAmount = rows.reduce((sum, row) => sum + row.totalMarginValue, 0);
    const grandTotal = sellTotal;
    const freight = Number(form.freight) || 0;
    // Mean of each row's Margin % - only rows that look like real line items
    // (have a product, price, or non-zero margin) so blank "Add row" lines don't dilute.
    const activeMarginPcts = lines
      .filter((line) => {
        const hasProduct = line.product_name.trim().length > 0;
        const hasPrice = (Number(line.unit_sell) || 0) > 0;
        const hasMargin = (Number(line.margin_pct) || 0) !== 0;
        return hasProduct || hasPrice || hasMargin;
      })
      .map((line) => Number(line.margin_pct) || 0);
    const avgMargin =
      activeMarginPcts.length > 0
        ? activeMarginPcts.reduce((sum, pct) => sum + pct, 0) / activeMarginPcts.length
        : 0;
    return {
      rows,
      byKey,
      avgMargin,
      marginAmount,
      grandTotal,
      grandWithFreight: grandTotal + freight,
    };
  }, [form.freight, lines]);

  async function uploadFile(
    targetQuoteId: string,
    file: File,
    category: "boq" | "vendor_quote",
  ) {
    if (!opportunity) return;
    await createAttachment({
      entity_type: "quote",
      entity_id: targetQuoteId,
      branch_id: opportunity.branch_id,
      company_id: opportunity.company_id,
      file_name: file.name,
      category,
      content_base64: await fileToBase64(file),
      content_type: file.type || "application/octet-stream",
    });
  }

  function linePayload(line: LineDraft) {
    const unitPrice = Number(line.unit_sell) || 0;
    const marginPct = Number(line.margin_pct) || 0;
    return {
      product_name: line.product_name.trim(),
      hsn_sac: line.hsn_sac || null,
      description: line.description || null,
      sub_product_category: isServiceLine(line)
        ? null
        : line.sub_product_category.trim() || null,
      line_type: line.line_type || "hardware",
      qty: Number(line.qty) || 1,
      unit_cost: unitPrice,
      unit_sell: unitPrice * (1 + marginPct / 100),
      margin_pct: marginPct,
      gst_pct: Number(line.gst_pct) || 0,
    };
  }

  function subProductOptionsForLine(line: LineDraft): string[] {
    const selected = line.sub_product_category.trim();
    if (selected && !leadSubProductCategories.includes(selected)) {
      return [selected, ...leadSubProductCategories];
    }
    return leadSubProductCategories;
  }

  function addLineRow(lineType: string) {
    const defaultSub =
      leadSubProductCategories.length === 1 ? leadSubProductCategories[0] : "";
    setLines((current) => [
      ...current,
      { ...newLine(lineType), sub_product_category: defaultSub },
    ]);
  }

  function renderSubProductSelect(line: LineDraft) {
    const options = subProductOptionsForLine(line);
    return (
      <td className="px-2 py-2">
        <FinanceSelect
          className="w-40 min-w-[9rem] cursor-pointer"
          value={line.sub_product_category}
          disabled={options.length === 0}
          onChange={(e) => setLine(line.key, "sub_product_category", e.target.value)}
        >
          <option value="">
            {options.length === 0 ? "No lead sub-products" : "Select"}
          </option>
          {options.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </FinanceSelect>
      </td>
    );
  }

  function quotePayload() {
    return {
      contact_id: form.contact_id || null,
      subject:
        form.subject.trim() ||
        opportunity?.opportunity_name?.trim() ||
        form.project_title.trim() ||
        null,
      project_title: form.project_title.trim() || null,
      account_name: form.account_name.trim() || null,
      service_type: form.service_type || null,
      owner_name: stripEmployeeCodeSuffix(form.owner_name.trim()) || null,
      valid_until: form.valid_until || null,
      entity_name: form.entity_name || null,
      entity_email: form.entity_email || null,
      entity_address: form.entity_address || null,
      entity_gst: form.entity_gst || null,
      entity_contact: form.entity_contact || null,
      amc_warranty: form.amc_warranty || "none",
      amc_start_date: form.amc_start_date || null,
      amc_end_date: form.amc_end_date || null,
      billing_street: form.billing_street || null,
      billing_city: form.billing_city || null,
      billing_state: form.billing_state || null,
      billing_zip: form.billing_zip || null,
      billing_country: form.billing_country || null,
      shipping_street: form.shipping_street || null,
      shipping_city: form.shipping_city || null,
      shipping_state: form.shipping_state || null,
      shipping_zip: form.shipping_zip || null,
      shipping_country: form.shipping_country || null,
      freight: Number(form.freight) || 0,
      terms: form.terms || null,
      description: form.description || null,
      reason_for_discount: form.reason_for_discount || null,
      custom_fields: customFields,
    };
  }

  async function onSave() {
    if (!opportunity) return;
    const missing: string[] = [];
    pushRequired(missing, quoteFields, "subject", "Subject", !form.subject.trim(), true);
    pushRequired(missing, quoteFields, "valid_until", "Price Validity Date", !form.valid_until.trim(), true);
    if (lines.length === 0) {
      missing.push("At least one quoted item row");
    }
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const rowLabel = `Row ${index + 1}`;
      if (!line.product_name.trim()) missing.push(`${rowLabel}: Product Name`);
      if (!line.description.trim()) missing.push(`${rowLabel}: Item Description`);
      if (!line.qty.trim() || Number(line.qty) <= 0) missing.push(`${rowLabel}: Quantity`);
      if (!line.unit_sell.trim() || Number(line.unit_sell) <= 0) missing.push(`${rowLabel}: Unit Price`);
      if (!line.margin_pct.trim()) missing.push(`${rowLabel}: Margin %`);
      if (!line.gst_pct.trim()) missing.push(`${rowLabel}: GST %`);
    }
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let savedId: string;
      if (isEdit && quoteId) {
        const saved = await updateQuote(quoteId, quotePayload());
        const keptIds = new Set(lines.map((line) => line.serverId).filter(Boolean) as string[]);
        // Line add/update/delete each recomputes quote totals with optimistic locking —
        // must run sequentially to avoid StaleDataError / 409 races.
        for (const id of initialLineIds.filter((lineId) => !keptIds.has(lineId))) {
          await deleteQuoteLine(id);
        }
        for (const line of lines) {
          if (line.serverId) {
            await updateQuoteLine(line.serverId, linePayload(line));
          } else {
            await addQuoteLine(saved.id, linePayload(line));
          }
        }
        const files = lines.flatMap((line) =>
          line.vendorFile
            ? [{ file: line.vendorFile, category: "vendor_quote" as const }]
            : [],
        );
        await Promise.all(files.map(({ file, category }) => uploadFile(saved.id, file, category)));
        savedId = saved.id;
      } else {
        const created = await createQuote({
          opportunity_id: opportunity.id,
          branch_id: opportunity.branch_id,
          ...quotePayload(),
        });
        for (const line of lines) {
          await addQuoteLine(created.id, linePayload(line));
        }
        const files = lines.flatMap((line) =>
          line.vendorFile
            ? [{ file: line.vendorFile, category: "vendor_quote" as const }]
            : [],
        );
        await Promise.all(files.map(({ file, category }) => uploadFile(created.id, file, category)));
        savedId = created.id;
      }

      router.push(`/crm/quotes/${savedId}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : isEdit
            ? "Failed to update quote"
            : "Failed to create quote",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/60" />;
  }

  const backHref = isEdit && quoteId
    ? `/crm/quotes/${quoteId}`
    : `/crm/opportunities/${opportunityId ?? opportunity?.id ?? ""}`;
  const backLabel = isEdit ? formatCrmCode(quote?.quote_no) || "Quote" : "Opportunity";

  return (
    <CrmPage className="grid min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-clip space-y-0">
      <Link
        href={backHref}
        className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> {backLabel}
      </Link>
      <PageHeader
        className="min-w-0"
        title={isEdit ? `Edit ${formatCrmCode(quote?.quote_no) || "Quote"}` : "Create Quote"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {opportunity?.has_services && opportunity.service_sourcing_channel ? (
              <span className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 px-2.5 text-xs font-medium text-foreground">
                Service sourcing: {opportunity.service_sourcing_channel}
              </span>
            ) : null}
            <Link
              href={backHref}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            >
              Cancel
            </Link>
            <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save Quote"}
            </Button>
          </div>
        }
      />
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="Quote Information" icon={FileText} className="min-w-0 overflow-x-clip">
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Project Title">
            <Input
              value={form.project_title}
              onChange={(event) => setField("project_title", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Account Name">
            <Input
              value={form.account_name}
              onChange={(event) => setField("account_name", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Price Validity Date *">
            <Input
              type="date"
              value={form.valid_until}
              onChange={(event) => setField("valid_until", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Contact Name">
            <FinanceSelect
              value={form.contact_id}
              onChange={(event) => setField("contact_id", event.target.value)}
            >
              <option value="">Select contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {fullName(contact)}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <CrmSessionEmployeeField label="Quote Owner" value={form.owner_name} />
          <FinanceField label="Quote No.">
            <Input
              value={
                isEdit
                  ? formatCrmCode(quote?.quote_no) || "-"
                  : formatCrmCode(nextQuoteNo) || "Assigning…"
              }
              disabled
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Entity Information" icon={Building2} className="min-w-0 overflow-x-clip">
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name"><Input value={form.entity_name} onChange={(e) => setField("entity_name", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Address"><Input value={form.entity_address} onChange={(e) => setField("entity_address", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Contact Number"><Input value={form.entity_contact} onChange={(e) => setField("entity_contact", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Email"><Input type="email" value={form.entity_email} onChange={(e) => setField("entity_email", e.target.value)} /></FinanceField>
          <FinanceField label="Entity GST No."><Input value={form.entity_gst} onChange={(e) => setField("entity_gst", e.target.value)} /></FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Terms and Conditions" icon={Scale} className="min-w-0 overflow-x-clip">
        <div className="grid min-w-0 grid-cols-1 gap-y-3">
          <FinanceField label="Terms and Conditions">
            <FinanceTextarea
              value={form.terms}
              onChange={(e) => setField("terms", e.target.value)}
              className="min-h-[180px]"
            />
          </FinanceField>
          <FinanceField label="AMC/Warranty">
            <FinanceSelect
              value={form.amc_warranty}
              onChange={(e) => setField("amc_warranty", e.target.value)}
            >
              <option value="none">None</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Start Date">
            <Input
              type="date"
              value={form.amc_start_date}
              onChange={(e) => setField("amc_start_date", e.target.value)}
            />
          </FinanceField>
          <FinanceField label="End Date">
            <Input
              type="date"
              value={form.amc_end_date}
              onChange={(e) => setField("amc_end_date", e.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>

      <CrmSection
        title="Customer Address Information"
        icon={MapPin}
        actions={
          <FinanceSelect
            value={copyAddressAction}
            onChange={(e) => onCopyAddressChange(e.target.value)}
            className="h-8 min-w-[180px] cursor-pointer text-xs"
          >
            <option value="">Copy address…</option>
            <option value="billing_to_shipping">Billing to Shipping</option>
            <option value="shipping_to_billing">Shipping to Billing</option>
          </FinanceSelect>
        }
      >
        <div className="grid min-w-0 gap-x-10 gap-y-5 lg:grid-cols-2">
          <div className="grid min-w-0 grid-cols-1 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing Address</p>
            <FinanceField label="Street">
              <Input value={form.billing_street} onChange={(e) => setField("billing_street", e.target.value)} />
            </FinanceField>
            <FinanceField label="City">
              <Input value={form.billing_city} onChange={(e) => setField("billing_city", e.target.value)} />
            </FinanceField>
            <FinanceField label="State">
              <Input value={form.billing_state} onChange={(e) => setField("billing_state", e.target.value)} />
            </FinanceField>
            <FinanceField label="Zip Code">
              <Input value={form.billing_zip} onChange={(e) => setField("billing_zip", e.target.value)} />
            </FinanceField>
            <FinanceField label="Country">
              <Input value={form.billing_country} onChange={(e) => setField("billing_country", e.target.value)} />
            </FinanceField>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping Address</p>
            <FinanceField label="Street">
              <Input value={form.shipping_street} onChange={(e) => setField("shipping_street", e.target.value)} />
            </FinanceField>
            <FinanceField label="City">
              <Input value={form.shipping_city} onChange={(e) => setField("shipping_city", e.target.value)} />
            </FinanceField>
            <FinanceField label="State">
              <Input value={form.shipping_state} onChange={(e) => setField("shipping_state", e.target.value)} />
            </FinanceField>
            <FinanceField label="Zip Code">
              <Input value={form.shipping_zip} onChange={(e) => setField("shipping_zip", e.target.value)} />
            </FinanceField>
            <FinanceField label="Country">
              <Input value={form.shipping_country} onChange={(e) => setField("shipping_country", e.target.value)} />
            </FinanceField>
          </div>
        </div>
      </CrmSection>

      {showProductsTable ? (
        <CrmListPanel className="min-w-0 max-w-full overflow-x-clip">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CrmIconBadge icon={ListOrdered} />
              <h2 className="text-base font-extrabold tracking-tight">Quoted Products</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={importingVendor}
                onClick={() => vendorImportRef.current?.click()}
              >
                <FileInput className="size-3.5" />{" "}
                {importingVendor ? "Reading quote…" : "Import from vendor quote"}
              </Button>
              <input
                ref={vendorImportRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt"
                className="hidden"
                aria-label="Vendor quote file"
                onChange={(e) => void importVendorQuote(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => addLineRow("hardware")}
              >
                <Plus className="size-3.5" /> Add row
              </Button>
            </div>
          </div>
          {vendorImportNote ? (
            <p
              className="border-b border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
              role="status"
            >
              {vendorImportNote}
            </p>
          ) : null}
          <div className="erp-scroll min-w-0 overflow-x-auto">
            <table className="w-max min-w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  {LINE_TABLE_HEADERS.map((label) => (
                    <th key={label || "actions"} className="whitespace-nowrap px-2 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={LINE_TABLE_HEADERS.length}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No product lines yet. Add a row or import from a vendor quote.
                    </td>
                  </tr>
                ) : (
                  productLines.map((line, index) => {
                    const rowTotal = totals.byKey[line.key];
                    return (
                      <tr key={line.key} className="border-b last:border-0">
                        <td className="px-2 py-2 text-center">{index + 1}</td>
                        {renderSubProductSelect(line)}
                        <td className="px-2 py-2">
                          <Input
                            className="w-40 min-w-[9rem]"
                            value={line.product_name}
                            onChange={(e) => setLine(line.key, "product_name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-24 min-w-[6rem]"
                            value={line.hsn_sac}
                            onChange={(e) => setLine(line.key, "hsn_sac", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-44 min-w-[10rem]"
                            value={line.description}
                            onChange={(e) => setLine(line.key, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-20"
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => setLine(line.key, "qty", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-28"
                            type="number"
                            min={0}
                            value={line.unit_sell}
                            onChange={(e) => setLine(line.key, "unit_sell", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-28"
                            type="number"
                            min={0}
                            step="any"
                            value={line.margin_pct}
                            onChange={(e) => setLine(line.key, "margin_pct", e.target.value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.unitMarginValue ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.unitPriceMargin ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.totalMarginValue ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums">
                          {formatInrPrecise(rowTotal?.totalQtyPriceMargin ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-20"
                            type="number"
                            min={0}
                            value={line.gst_pct}
                            onChange={(e) => setLine(line.key, "gst_pct", e.target.value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.gstAmount ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums">
                          {formatInrPrecise(rowTotal?.withGst ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="cursor-pointer text-destructive"
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((current) => current.filter((row) => row.key !== line.key))
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      ) : null}

      {showServicesTable ? (
        <CrmListPanel className="min-w-0 max-w-full overflow-x-clip">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CrmIconBadge icon={ListOrdered} />
              <h2 className="text-base font-extrabold tracking-tight">Quoted Services</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => addLineRow("services")}
            >
              <Plus className="size-3.5" /> Add row
            </Button>
          </div>
          <div className="erp-scroll min-w-0 overflow-x-auto">
            <table className="w-max min-w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  {SERVICE_LINE_TABLE_HEADERS.map((label) => (
                    <th key={label || "service-actions"} className="whitespace-nowrap px-2 py-2">
                      {label === "Product Name" ? "Service Name" : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={SERVICE_LINE_TABLE_HEADERS.length}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No service lines yet. Add a row for implementation, support, or AMC.
                    </td>
                  </tr>
                ) : (
                  serviceLines.map((line, index) => {
                    const rowTotal = totals.byKey[line.key];
                    return (
                      <tr key={line.key} className="border-b last:border-0">
                        <td className="px-2 py-2 text-center">{index + 1}</td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-40 min-w-[9rem]"
                            value={line.product_name}
                            onChange={(e) => setLine(line.key, "product_name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-24 min-w-[6rem]"
                            value={line.hsn_sac}
                            onChange={(e) => setLine(line.key, "hsn_sac", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-44 min-w-[10rem]"
                            value={line.description}
                            onChange={(e) => setLine(line.key, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-20"
                            type="number"
                            min={0}
                            value={line.qty}
                            onChange={(e) => setLine(line.key, "qty", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-28"
                            type="number"
                            min={0}
                            value={line.unit_sell}
                            onChange={(e) => setLine(line.key, "unit_sell", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-28"
                            type="number"
                            min={0}
                            step="any"
                            value={line.margin_pct}
                            onChange={(e) => setLine(line.key, "margin_pct", e.target.value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.unitMarginValue ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.unitPriceMargin ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.totalMarginValue ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums">
                          {formatInrPrecise(rowTotal?.totalQtyPriceMargin ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="w-20"
                            type="number"
                            min={0}
                            value={line.gst_pct}
                            onChange={(e) => setLine(line.key, "gst_pct", e.target.value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatInrPrecise(rowTotal?.gstAmount ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-medium tabular-nums">
                          {formatInrPrecise(rowTotal?.withGst ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="cursor-pointer text-destructive"
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((current) => current.filter((row) => row.key !== line.key))
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CrmListPanel>
      ) : null}

      <CrmListPanel className="min-w-0 max-w-full overflow-x-clip">
        <div className="ml-auto w-full max-w-sm space-y-2.5 px-4 py-4 text-xs sm:px-5">
          <div className="flex items-baseline justify-between gap-6">
            <span className="shrink-0 text-muted-foreground">Margin in Avg (%)</span>
            <span className="tabular-nums text-foreground">{formatMarginPctInput(totals.avgMargin)}%</span>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <span className="shrink-0 text-muted-foreground">Total Margin Amount</span>
            <span className="tabular-nums text-foreground">{formatInrPrecise(totals.marginAmount)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <span className="shrink-0 text-muted-foreground">Grand Total (ex. GST)</span>
            <span className="tabular-nums text-foreground">{formatInrPrecise(totals.grandTotal)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-t border-border/70 pt-3 font-medium text-foreground">
            <span className="shrink-0">Grand Total</span>
            <span className="tabular-nums">{formatInrPrecise(totals.grandWithFreight)}</span>
          </div>
        </div>
      </CrmListPanel>

      <CrmCustomFieldsSection entity="quote" values={customFields} onChange={setCustomFields} />

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
