"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FileText, ListOrdered, Paperclip, Plus, Scale, Trash2 } from "lucide-react";

import { CrmErrorBanner, CrmIconBadge, CrmListPanel, CrmPage, CrmSection } from "@/components/crm/crm-ui";
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
  addQuoteLine,
  createAttachment,
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
  listEmployeeOptions,
  listQuoteLines,
  updateQuote,
  updateQuoteLine,
  type Contact,
  type Opportunity,
  type Option,
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
  billing_country: string;
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
  service_type: "hardware",
  owner_name: "",
  subject: "",
  valid_until: "",
  entity_name: "",
  entity_email: "",
  entity_address: "",
  entity_gst: "",
  entity_contact: "",
  billing_country: "",
  shipping_country: "",
  description: "",
  reason_for_discount: "",
  terms: "",
  freight: "0",
};

function newLine(source?: SalesLead | null): LineDraft {
  const productName =
    source?.sub_product || source?.sub_product_other || source?.sub_product_category || "";
  const sourceType = source?.product_type ?? "";
  return {
    key: crypto.randomUUID(),
    product_name: productName,
    hsn_sac: "",
    description: source?.notes ?? "",
    line_type: ["hardware", "software", "services"].includes(sourceType) ? sourceType : "hardware",
    qty: "1",
    unit_cost: "0",
    unit_sell: "0",
    margin_pct: "0",
    gst_pct: "18",
    vendorFile: null,
  };
}

export function QuoteFormPage({
  opportunityId,
  quoteId,
}: {
  opportunityId?: string;
  quoteId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(quoteId);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [form, setForm] = useState<QuoteDraft>(EMPTY_FORM);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [initialLineIds, setInitialLineIds] = useState<string[]>([]);
  const [boqFiles, setBoqFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

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
          listEmployeeOptions().catch(() => []),
        ]);
        setQuote(quoteRow);
        setOpportunity(opportunityRow);
        setContacts(contactRows);
        setEmployees(employeeRows);
        setForm({
          project_title: quoteRow.project_title ?? "",
          account_name: quoteRow.account_name ?? "",
          contact_id: quoteRow.contact_id ?? "",
          service_type: quoteRow.service_type ?? "",
          owner_name: quoteRow.owner_name ?? "",
          subject: quoteRow.subject ?? "",
          valid_until: quoteRow.valid_until ?? "",
          entity_name: quoteRow.entity_name ?? "",
          entity_email: quoteRow.entity_email ?? "",
          entity_address: quoteRow.entity_address ?? "",
          entity_gst: quoteRow.entity_gst ?? "",
          entity_contact: quoteRow.entity_contact ?? "",
          billing_country: quoteRow.billing_country ?? "",
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
                line_type: line.line_type || "hardware",
                qty: String(line.qty ?? 1),
                unit_cost: String(line.unit_cost ?? 0),
                unit_sell: String(line.unit_cost ?? 0),
                margin_pct: String(line.margin_pct ?? 0),
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
      const [companyRow, leadRow, contactRows, employeeRows, blueprint] = await Promise.all([
        opportunityRow.company_account_id
          ? getCompany(opportunityRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
        opportunityRow.lead_id
          ? getSalesLead(opportunityRow.lead_id).catch(() => null)
          : Promise.resolve(null),
        opportunityRow.company_account_id
          ? listContacts(opportunityRow.company_account_id).catch(() => [])
          : Promise.resolve([]),
        listEmployeeOptions().catch(() => []),
        getOpportunityBlueprint(opportunityId).catch(() => null),
      ]);
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
      setContacts(contactRows);
      setEmployees(employeeRows);

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
      const primaryContact = contactRows.find((contact) => contact.is_primary) ?? contactRows[0];
      const ownerLabel =
        employeeRows.find((employee) => employee.id === opportunityRow.owner_employee_id)?.label ??
        "";
      setForm({
        project_title: opportunityRow.project_title || opportunityRow.opportunity_name || "",
        account_name: companyRow?.customer_name ?? "",
        contact_id: primaryContact?.id ?? "",
        service_type: "",
        owner_name: ownerLabel,
        subject: "",
        valid_until: "",
        entity_name: leadRow?.entity_name || companyRow?.customer_name || "",
        entity_email: leadRow?.entity_email || companyRow?.customer_email || "",
        entity_address: leadRow?.entity_address || billingAddress,
        entity_gst: leadRow?.entity_gst || "",
        entity_contact: leadRow?.entity_contact || companyRow?.phone || "",
        billing_country: companyRow?.billing_country || "",
        shipping_country: companyRow?.shipping_country || companyRow?.billing_country || "",
        description: leadRow?.notes || companyRow?.description || "",
        reason_for_discount: "",
        terms: "",
        freight: "0",
      });
      setLines([newLine(leadRow)]);
      setInitialLineIds([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load quote details");
    } finally {
      setLoading(false);
    }
  }, [isEdit, opportunityId, quoteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setLine(key: string, field: keyof Omit<LineDraft, "key">, value: string | File | null) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  }

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
    const sellTotal = rows.reduce((sum, row) => sum + row.sellTotal, 0);
    const marginAmount = rows.reduce((sum, row) => sum + row.totalMarginValue, 0);
    const grandTotal = sellTotal;
    const freight = Number(form.freight) || 0;
    // Mean of each row's Margin % — only rows that look like real line items
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
      line_type: line.line_type,
      qty: Number(line.qty) || 1,
      unit_cost: unitPrice,
      unit_sell: unitPrice * (1 + marginPct / 100),
      gst_pct: Number(line.gst_pct) || 0,
    };
  }

  function quotePayload() {
    return {
      contact_id: form.contact_id || null,
      subject: form.subject.trim(),
      project_title: form.project_title.trim() || null,
      account_name: form.account_name.trim() || null,
      service_type: form.service_type || null,
      owner_name: form.owner_name.trim() || null,
      valid_until: form.valid_until || null,
      entity_name: form.entity_name || null,
      entity_email: form.entity_email || null,
      entity_address: form.entity_address || null,
      entity_gst: form.entity_gst || null,
      entity_contact: form.entity_contact || null,
      billing_country: form.billing_country || null,
      shipping_country: form.shipping_country || null,
      freight: Number(form.freight) || 0,
      terms: form.terms || null,
      description: form.description || null,
      reason_for_discount: form.reason_for_discount || null,
    };
  }

  async function onSave() {
    if (!opportunity) return;
    const missing: string[] = [];
    if (!form.subject.trim()) missing.push("Subject");
    if (!form.valid_until.trim()) missing.push("Valid Until");
    if (!form.service_type.trim()) missing.push("Service Type");
    if (lines.some((line) => !line.product_name.trim())) missing.push("Product Name (quoted items)");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && quoteId) {
        const saved = await updateQuote(quoteId, quotePayload());
        const keptIds = new Set(lines.map((line) => line.serverId).filter(Boolean) as string[]);
        await Promise.all(
          initialLineIds
            .filter((id) => !keptIds.has(id))
            .map((id) => deleteQuoteLine(id)),
        );
        await Promise.all(
          lines.map((line) =>
            line.serverId
              ? updateQuoteLine(line.serverId, linePayload(line))
              : addQuoteLine(saved.id, linePayload(line)),
          ),
        );
        const files = [
          ...boqFiles.map((file) => ({ file, category: "boq" as const })),
          ...lines.flatMap((line) =>
            line.vendorFile
              ? [{ file: line.vendorFile, category: "vendor_quote" as const }]
              : [],
          ),
        ];
        await Promise.all(files.map(({ file, category }) => uploadFile(saved.id, file, category)));
        router.push(`/crm/quotes/${saved.id}`);
        return;
      }

      const created = await createQuote({
        opportunity_id: opportunity.id,
        branch_id: opportunity.branch_id,
        ...quotePayload(),
      });
      await Promise.all(lines.map((line) => addQuoteLine(created.id, linePayload(line))));
      const files = [
        ...boqFiles.map((file) => ({ file, category: "boq" as const })),
        ...lines.flatMap((line) =>
          line.vendorFile
            ? [{ file: line.vendorFile, category: "vendor_quote" as const }]
            : [],
        ),
      ];
      await Promise.all(files.map(({ file, category }) => uploadFile(created.id, file, category)));
      router.push(`/crm/quotes/${created.id}`);
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
  const backLabel = isEdit ? quote?.quote_no ?? "Quote" : "Opportunity";

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
        title={isEdit ? `Edit ${quote?.quote_no ?? "Quote"}` : "Create Quote"}
        description={
          isEdit
            ? "Update quote details, entity information, and quoted items."
            : "Customer quote details are prefilled from the Company, Lead, and Opportunity — edit anything before saving."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
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

      <CrmSection title="Quote Information" icon={FileText} className="min-w-0 overflow-x-clip">
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Customer's Project Title">
            <Input
              value={form.project_title}
              onChange={(event) => setField("project_title", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Subject *">
            <Input value={form.subject} onChange={(event) => setField("subject", event.target.value)} />
          </FinanceField>
          <FinanceField label="Account Name">
            <Input
              value={form.account_name}
              onChange={(event) => setField("account_name", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Valid Until *">
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
          <FinanceField label="Quote Owner">
            <FinanceSelect
              value={form.owner_name}
              onChange={(event) => setField("owner_name", event.target.value)}
            >
              <option value="">Select owner</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.label}>
                  {employee.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Service Type *">
            <FinanceSelect
              value={form.service_type}
              onChange={(event) => setField("service_type", event.target.value)}
            >
              <option value="">Select</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="services">Services</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Quote No.">
            <Input value={isEdit ? quote?.quote_no ?? "-" : "Auto-generated on save"} disabled />
          </FinanceField>
          <FinanceField label="Quote Stage">
            <Input
              value={
                isEdit
                  ? (quote?.quote_stage ?? "").replaceAll("_", " ") || "-"
                  : "Quote Create"
              }
              disabled
              className="capitalize"
            />
          </FinanceField>
          <FinanceField label="Version">
            <Input value={isEdit ? String(quote?.version ?? 1) : "1"} disabled />
          </FinanceField>
          <FinanceField label="Approval Status">
            <Input
              value={
                isEdit
                  ? (quote?.approval_status ?? "").replaceAll("_", " ") || "-"
                  : "Not required"
              }
              disabled
              className="capitalize"
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

      <CrmSection title="Additional Information" icon={FileText} className="min-w-0 overflow-x-clip">
        <div className="min-w-0 space-y-3">
          <FinanceField label="Sales Order ID"><Input value={opportunity?.sales_order_id ?? ""} disabled /></FinanceField>
          <FinanceField label="Description"><FinanceTextarea value={form.description} onChange={(e) => setField("description", e.target.value)} /></FinanceField>
          <FinanceField label="Reason For Discount"><FinanceTextarea value={form.reason_for_discount} onChange={(e) => setField("reason_for_discount", e.target.value)} /></FinanceField>
        </div>
      </CrmSection>

      <CrmSection title="Terms and Conditions" icon={Scale} className="min-w-0 overflow-x-clip">
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Terms and Conditions" className="md:col-span-2"><FinanceTextarea value={form.terms} onChange={(e) => setField("terms", e.target.value)} /></FinanceField>
          <FinanceField label="Freight Charges (₹)"><Input type="number" min={0} value={form.freight} onChange={(e) => setField("freight", e.target.value)} /></FinanceField>
          <FinanceField label="BOQ Attachment (multiple)">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 cursor-pointer"
                  onClick={() => document.getElementById("quote-boq-file")?.click()}
                >
                  <Paperclip className="size-3.5" /> Choose files
                </Button>
                <input
                  id="quote-boq-file"
                  type="file"
                  multiple
                  className="hidden"
                  tabIndex={-1}
                  onChange={(e) => setBoqFiles(Array.from(e.target.files ?? []))}
                />
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {boqFiles.length === 0
                    ? "No files selected"
                    : `${boqFiles.length} file${boqFiles.length === 1 ? "" : "s"} selected`}
                </span>
              </div>
              {boqFiles.length > 0 ? (
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {boqFiles.map((file) => (
                    <li key={file.name} className="truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </FinanceField>
          <FinanceField label="Billing Country"><Input value={form.billing_country} onChange={(e) => setField("billing_country", e.target.value)} /></FinanceField>
          <FinanceField label="Shipping Country"><Input value={form.shipping_country} onChange={(e) => setField("shipping_country", e.target.value)} /></FinanceField>
        </div>
      </CrmSection>

      <CrmListPanel className="min-w-0 max-w-full overflow-x-clip">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CrmIconBadge icon={ListOrdered} />
            <h2 className="text-sm font-medium">Quoted Items</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setLines((current) => [...current, newLine()])}
          >
            <Plus className="size-3.5" /> Add row
          </Button>
        </div>
        <div className="erp-scroll min-w-0 overflow-x-auto">
          <table className="w-max min-w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                {[
                  "S.No",
                  "Product Name",
                  "HSN/SAC Code",
                  "Item Description",
                  "Service Type",
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
                  "Vendor Quote Attach",
                  "",
                ].map((label) => (
                  <th key={label || "actions"} className="whitespace-nowrap px-2 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const rowTotal = totals.rows[index];
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
                      <FinanceSelect
                        className="w-28 min-w-[6.5rem]"
                        value={line.line_type}
                        onChange={(e) => setLine(line.key, "line_type", e.target.value)}
                      >
                        <option value="hardware">Hardware</option>
                        <option value="software">Software</option>
                        <option value="services">Services</option>
                      </FinanceSelect>
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
                        className="w-20"
                        type="number"
                        min={0}
                        step="0.01"
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
                    <td className="max-w-[11rem] px-2 py-2">
                      <div className="relative max-w-[11rem]">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          title={line.vendorFile?.name ?? "Choose file"}
                          className="h-8 max-w-full cursor-pointer justify-start gap-1 px-2"
                          onClick={(event) => {
                            const input = event.currentTarget
                              .parentElement
                              ?.querySelector<HTMLInputElement>('input[type="file"]');
                            input?.click();
                          }}
                        >
                          <Paperclip className="size-3 shrink-0" />
                          <span className="min-w-0 truncate">
                            {line.vendorFile?.name ?? "Choose file"}
                          </span>
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          tabIndex={-1}
                          onChange={(e) =>
                            setLine(line.key, "vendorFile", e.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="cursor-pointer text-destructive"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) => current.filter((row) => row.key !== line.key))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="ml-auto w-full max-w-sm space-y-2.5 border-t border-border/70 px-4 py-4 text-xs sm:px-5">
          <div className="flex items-baseline justify-between gap-6">
            <span className="shrink-0 text-muted-foreground">Margin in Avg (%)</span>
            <span className="tabular-nums text-foreground">{totals.avgMargin.toFixed(3)}%</span>
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
            <span className="shrink-0">Grand Total including Freight</span>
            <span className="tabular-nums">{formatInrPrecise(totals.grandWithFreight)}</span>
          </div>
        </div>
      </CrmListPanel>
      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
