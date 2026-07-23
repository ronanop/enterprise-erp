"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Plus, Trash2 } from "lucide-react";

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
  addQuoteLine,
  createAttachment,
  createQuote,
  fileToBase64,
  formatInrPrecise,
  fullName,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getSalesLead,
  listContacts,
  listEmployeeOptions,
  type Contact,
  type Opportunity,
  type Option,
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
  product_name: string;
  hsn_sac: string;
  description: string;
  line_type: string;
  qty: string;
  unit_cost: string;
  unit_sell: string;
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

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
    gst_pct: "18",
    vendorFile: null,
  };
}

export function QuoteFormPage({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [form, setForm] = useState<QuoteDraft>(EMPTY_FORM);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      const serviceType =
        leadRow?.product_type && ["hardware", "software", "services"].includes(leadRow.product_type)
          ? leadRow.product_type
          : "hardware";
      setForm({
        project_title: opportunityRow.project_title || opportunityRow.opportunity_name || "",
        account_name: companyRow?.customer_name ?? "",
        contact_id: primaryContact?.id ?? "",
        service_type: serviceType,
        owner_name: ownerLabel,
        subject: opportunityRow.project_title || opportunityRow.opportunity_name,
        valid_until: defaultValidUntil(),
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
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load quote details");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

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
      const cost = Number(line.unit_cost) || 0;
      const sell = Number(line.unit_sell) || 0;
      const gstPct = Number(line.gst_pct) || 0;
      const sellTotal = qty * sell;
      const marginAmount = qty * (sell - cost);
      const gstAmount = (sellTotal * gstPct) / 100;
      return {
        sellTotal,
        marginAmount,
        marginPct: sell ? ((sell - cost) / sell) * 100 : 0,
        gstAmount,
        withGst: sellTotal + gstAmount,
      };
    });
    const sellTotal = rows.reduce((sum, row) => sum + row.sellTotal, 0);
    const marginAmount = rows.reduce((sum, row) => sum + row.marginAmount, 0);
    const grandTotal = rows.reduce((sum, row) => sum + row.withGst, 0);
    const freight = Number(form.freight) || 0;
    return {
      rows,
      avgMargin: sellTotal ? (marginAmount / sellTotal) * 100 : 0,
      marginAmount,
      grandTotal,
      grandWithFreight: grandTotal + freight,
    };
  }, [form.freight, lines]);

  async function uploadFile(
    quoteId: string,
    file: File,
    category: "boq" | "vendor_quote",
  ) {
    if (!opportunity) return;
    await createAttachment({
      entity_type: "quote",
      entity_id: quoteId,
      branch_id: opportunity.branch_id,
      company_id: opportunity.company_id,
      file_name: file.name,
      category,
      content_base64: await fileToBase64(file),
      content_type: file.type || "application/octet-stream",
    });
  }

  async function onSave() {
    if (!opportunity) return;
    if (!form.subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (lines.some((line) => !line.product_name.trim())) {
      setError("Product Name is required for every quoted item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const quote = await createQuote({
        opportunity_id: opportunity.id,
        branch_id: opportunity.branch_id,
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
      });
      await Promise.all(
        lines.map((line) =>
          addQuoteLine(quote.id, {
            product_name: line.product_name.trim(),
            hsn_sac: line.hsn_sac || null,
            description: line.description || null,
            line_type: line.line_type,
            qty: Number(line.qty) || 1,
            unit_cost: Number(line.unit_cost) || 0,
            unit_sell: Number(line.unit_sell) || 0,
            gst_pct: Number(line.gst_pct) || 0,
          }),
        ),
      );
      const files = [
        ...(boqFile ? [{ file: boqFile, category: "boq" as const }] : []),
        ...lines.flatMap((line) =>
          line.vendorFile
            ? [{ file: line.vendorFile, category: "vendor_quote" as const }]
            : [],
        ),
      ];
      await Promise.all(files.map(({ file, category }) => uploadFile(quote.id, file, category)));
      router.push(`/crm/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create quote");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/60" />;
  }

  return (
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-clip">
      <Link
        href={`/crm/opportunities/${opportunityId}`}
        className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> Opportunity
      </Link>
      <PageHeader
        className="min-w-0"
        title="Create Quote"
        description="Customer quote details are prefilled from the Company, Lead, and Opportunity — edit anything before saving."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/crm/opportunities/${opportunityId}`}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            >
              Cancel
            </Link>
            <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="min-w-0 overflow-x-clip rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Quote Information</h2>
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
          <FinanceField label="Valid Until">
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
          <FinanceField label="Service Type">
            <FinanceSelect
              value={form.service_type}
              onChange={(event) => setField("service_type", event.target.value)}
            >
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="services">Services</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Quote No.">
            <Input value="Auto-generated on save" disabled />
          </FinanceField>
          <FinanceField label="Quote Stage">
            <Input value="Quote Create" disabled />
          </FinanceField>
          <FinanceField label="Version">
            <Input value="1" disabled />
          </FinanceField>
          <FinanceField label="Approval Status">
            <Input value="Not required" disabled />
          </FinanceField>
        </div>
      </section>

      <section className="min-w-0 overflow-x-clip rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Entity Information</h2>
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Entity Name"><Input value={form.entity_name} onChange={(e) => setField("entity_name", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Address"><Input value={form.entity_address} onChange={(e) => setField("entity_address", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Contact Number"><Input value={form.entity_contact} onChange={(e) => setField("entity_contact", e.target.value)} /></FinanceField>
          <FinanceField label="Entity Email"><Input type="email" value={form.entity_email} onChange={(e) => setField("entity_email", e.target.value)} /></FinanceField>
          <FinanceField label="Entity GST No."><Input value={form.entity_gst} onChange={(e) => setField("entity_gst", e.target.value)} /></FinanceField>
        </div>
      </section>

      <section className="min-w-0 overflow-x-clip rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Additional Information</h2>
        <div className="min-w-0 space-y-3">
          <FinanceField label="Sales Order ID"><Input value={opportunity?.sales_order_id ?? ""} disabled /></FinanceField>
          <FinanceField label="Description"><FinanceTextarea value={form.description} onChange={(e) => setField("description", e.target.value)} /></FinanceField>
          <FinanceField label="Reason For Discount"><FinanceTextarea value={form.reason_for_discount} onChange={(e) => setField("reason_for_discount", e.target.value)} /></FinanceField>
        </div>
      </section>

      <section className="min-w-0 overflow-x-clip rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Terms and Conditions</h2>
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <FinanceField label="Terms and Conditions" className="md:col-span-2"><FinanceTextarea value={form.terms} onChange={(e) => setField("terms", e.target.value)} /></FinanceField>
          <FinanceField label="Freight Charges (₹)"><Input type="number" min={0} value={form.freight} onChange={(e) => setField("freight", e.target.value)} /></FinanceField>
          <FinanceField label="BOQ Attachment">
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => document.getElementById("quote-boq-file")?.click()}><Paperclip className="size-3.5" /> Choose file</Button>
              <input id="quote-boq-file" type="file" className="sr-only" onChange={(e) => setBoqFile(e.target.files?.[0] ?? null)} />
              <span className="min-w-0 truncate text-xs text-muted-foreground">{boqFile?.name ?? "No file selected"}</span>
            </div>
          </FinanceField>
          <FinanceField label="Billing Country"><Input value={form.billing_country} onChange={(e) => setField("billing_country", e.target.value)} /></FinanceField>
          <FinanceField label="Shipping Country"><Input value={form.shipping_country} onChange={(e) => setField("shipping_country", e.target.value)} /></FinanceField>
        </div>
      </section>

      <section className="grid min-w-0 max-w-full grid-cols-1 overflow-x-clip rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-medium">Quoted Items</h2>
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
                  "Unit Cost (₹)",
                  "Unit Price (₹)",
                  "Margin %",
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
                        value={line.unit_cost}
                        onChange={(e) => setLine(line.key, "unit_cost", e.target.value)}
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
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {rowTotal?.marginPct.toFixed(2) ?? "0.00"}
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
                      <label className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
                        <Paperclip className="size-3" /> {line.vendorFile?.name ?? "Choose file"}
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => setLine(line.key, "vendorFile", e.target.files?.[0] ?? null)}
                        />
                      </label>
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
        <div className="ml-auto grid max-w-md gap-2 p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin in Avg (%)</span>
            <span>{totals.avgMargin.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Margin Amount</span>
            <span>{formatInrPrecise(totals.marginAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grand Total</span>
            <span>{formatInrPrecise(totals.grandTotal)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Grand Total including Freight</span>
            <span>{formatInrPrecise(totals.grandWithFreight)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
