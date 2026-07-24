"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, IndianRupee } from "lucide-react";

import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { SyncedBanner } from "@/components/crm/sales/approval-banner";
import {
  OvfOrderLinesSection,
  customerRowsFromOvfLines,
  customerRowsFromQuoteLines,
  persistOvfOrderLinesAfterCreate,
  persistOvfOrderLinesOnUpdate,
  sumLineTotals,
  validateChargeAttachments,
  vendorRowsFromOvfLines,
  vendorRowsFromQuoteLines,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
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
  addOvfLine,
  createAttachment,
  createOvf,
  fileToBase64,
  fullName,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getOvf,
  getQuote,
  listContacts,
  listEmployeeOptions,
  listOvfLines,
  listOvfs,
  listQuoteLines,
  updateOvf,
  updateOvfLine,
  type Opportunity,
  type Ovf,
  type Quote,
} from "@/services/sales-crm-service";

type OvfDraft = {
  po_number: string;
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
  total_margin_amount: string;
  total_margin_pct: string;
  finance_cost_pct: string;
  approval_status: string;
};

const SEGMENTS = ["Hardware", "Software", "Services", "Cloud", "Networking", "Security"];
const SUB_SEGMENTS = ["Compute", "Storage", "Licensing", "Implementation", "Support", "Managed Services"];

const NUMBER_NO_SPIN =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export function OvfFormPage({ quoteId, ovfId }: { quoteId?: string; ovfId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(ovfId);
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [form, setForm] = useState<OvfDraft>({
    po_number: "",
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
    total_margin_amount: "",
    total_margin_pct: "",
    finance_cost_pct: "",
    approval_status: "not_required",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [customerRows, setCustomerRows] = useState<CustomerChargeRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorChargeRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isEdit && ovfId) {
        const ovfRow = await getOvf(ovfId);
        if (ovfRow.locked) {
          throw new ApiClientError("This OVF is locked and cannot be edited.", 409);
        }
        if (ovfRow.deal_won || ovfRow.shared_to_scm) {
          throw new ApiClientError(
            "OVF cannot be edited after it is shared to SCM or marked Deal Won.",
            409,
          );
        }
        const [quoteRow, opportunityRow, ovfLines] = await Promise.all([
          getQuote(ovfRow.quote_id),
          getOpportunity(ovfRow.opportunity_id),
          listOvfLines(ovfId).catch(() => []),
        ]);
        setOvf(ovfRow);
        setQuote(quoteRow);
        setOpportunity(opportunityRow);
        setCustomerRows(customerRowsFromOvfLines(ovfLines));
        setVendorRows(vendorRowsFromOvfLines(ovfLines));
        setForm({
          po_number: ovfRow.po_number ?? "",
          delivery_period: ovfRow.delivery_period ?? "",
          customer_name: ovfRow.customer_name ?? "",
          quote_name: ovfRow.quote_name ?? "",
          billing_address: ovfRow.billing_address ?? "",
          billing_state: ovfRow.billing_state ?? "",
          billing_country: ovfRow.billing_country ?? "",
          owner_name: ovfRow.owner_name ?? "",
          billing_contact_person: ovfRow.billing_contact_person ?? "",
          shipping_address: ovfRow.shipping_address ?? "",
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
          total_margin_amount: String(ovfRow.total_margin_amount ?? ""),
          total_margin_pct: String(ovfRow.total_margin_pct ?? ""),
          finance_cost_pct: String(ovfRow.finance_cost_pct ?? ""),
          approval_status: ovfRow.approval_status || "not_required",
        });
        return;
      }

      if (!quoteId) {
        throw new ApiClientError("Quote is required to create an OVF.", 400);
      }

      const quoteRow = await getQuote(quoteId);
      const opportunityRow = await getOpportunity(quoteRow.opportunity_id);
      const [companyRow, contactRows, employeeRows, blueprint, existingOvfs, quoteLines] =
        await Promise.all([
          opportunityRow.company_account_id
            ? getCompany(opportunityRow.company_account_id).catch(() => null)
            : Promise.resolve(null),
          opportunityRow.company_account_id
            ? listContacts(opportunityRow.company_account_id).catch(() => [])
            : Promise.resolve([]),
          listEmployeeOptions().catch(() => []),
          getOpportunityBlueprint(quoteRow.opportunity_id).catch(() => null),
          listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
          listQuoteLines(quoteId).catch(() => []),
        ]);
      if (quoteRow.quote_stage !== "accepted") {
        throw new ApiClientError("OVF can only be created from an accepted quote.", 409);
      }
      if (!blueprint || blueprint.state !== "ovf_ready" || blueprint.locked) {
        throw new ApiClientError(
          `OVF can only be created when the opportunity is at OVF Ready (current: ${blueprint?.state ?? "unknown"}).`,
          409,
        );
      }
      if (existingOvfs.length > 0) {
        throw new ApiClientError(
          "An OVF already exists for this opportunity. Open the existing OVF to continue.",
          409,
        );
      }
      const selectedContact =
        contactRows.find((row) => row.id === quoteRow.contact_id) ??
        contactRows.find((row) => row.is_primary) ??
        contactRows[0] ??
        null;
      const ownerName =
        employeeRows.find(
          (employee) => employee.id === opportunityRow.owner_employee_id,
        )?.label ?? "";
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
      setQuote(quoteRow);
      setOpportunity(opportunityRow);
      setCustomerRows(customerRowsFromQuoteLines(quoteLines));
      setVendorRows(vendorRowsFromQuoteLines(quoteLines));
      setForm((current) => ({
        ...current,
        customer_name: companyRow?.customer_name ?? quoteRow.entity_name ?? "",
        quote_name: quoteRow.subject ?? "",
        billing_address: quoteRow.entity_address ?? billingAddress,
        billing_state: companyRow?.billing_state ?? "",
        billing_country:
          quoteRow.billing_country ?? companyRow?.billing_country ?? "",
        owner_name: ownerName,
        billing_contact_person: contactName || quoteRow.entity_contact || "",
        shipping_address: shippingAddress,
        shipping_state: companyRow?.shipping_state ?? "",
        shipping_country:
          quoteRow.shipping_country ?? companyRow?.shipping_country ?? "",
        shipping_contact_person: contactName || quoteRow.entity_contact || "",
        account_name: companyRow?.customer_name ?? quoteRow.entity_name ?? "",
      }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF details");
    } finally {
      setLoading(false);
    }
  }, [isEdit, ovfId, quoteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<K extends keyof OvfDraft>(key: K, value: OvfDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);
  const freightAmount = Number(form.freight) || 0;
  const financeCostPct = Number(form.finance_cost_pct) || 0;
  const financeCostAmount = (totalSaleValue * financeCostPct) / 100;
  const totalMarginAmount = totalSaleValue - totalPurchaseValue - freightAmount - financeCostAmount;
  const totalMarginPct = totalSaleValue
    ? (totalMarginAmount / totalSaleValue) * 100
    : 0;

  function ovfPayload() {
    return {
      po_number: form.po_number.trim(),
      delivery_period: form.delivery_period || null,
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
      freight: Number(freightAmount.toFixed(2)),
      additional_charges: Number(Number(form.additional_charges || 0).toFixed(2)),
      total_margin_amount: Number(totalMarginAmount.toFixed(2)),
      total_margin_pct: Number(totalMarginPct.toFixed(3)),
      finance_cost_pct: Number(financeCostPct.toFixed(3)),
      approval_status: form.approval_status || "not_required",
    };
  }

  async function onSave() {
    if (!quote || !opportunity) return;
    const missing: string[] = [];
    if (!form.po_number.trim()) missing.push("PO Number");
    if (!form.delivery_period.trim()) missing.push("Delivery Period");
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
          freight: payload.freight,
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
        { addOvfLine, createAttachment, fileToBase64 },
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
        description={
          isEdit
            ? "Update OVF details, order lines, and commercial charges."
            : "OVF details are prefilled from the accepted Quote, Opportunity, and Company."
        }
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
      <SyncedBanner from="Company → Opportunity → Quote" />
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmSection title="OVF Module Information" icon={ClipboardCheck}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Customer Name"><Input value={form.customer_name} onChange={(event) => setField("customer_name", event.target.value)} /></FinanceField>
          <FinanceField label="Quote Name"><Input value={form.quote_name} onChange={(event) => setField("quote_name", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Address"><Input value={form.billing_address} onChange={(event) => setField("billing_address", event.target.value)} /></FinanceField>
          <FinanceField label="Quote No"><Input value={quote?.quote_no ?? "-"} disabled /></FinanceField>
          <FinanceField label="Billing State"><Input value={form.billing_state} onChange={(event) => setField("billing_state", event.target.value)} /></FinanceField>
          <FinanceField label="OVF Module Owner"><Input value={form.owner_name} onChange={(event) => setField("owner_name", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Contact Person"><Input value={form.billing_contact_person} onChange={(event) => setField("billing_contact_person", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Address *"><Input value={form.shipping_address} onChange={(event) => setField("shipping_address", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Country"><Input value={form.billing_country} onChange={(event) => setField("billing_country", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping State"><Input value={form.shipping_state} onChange={(event) => setField("shipping_state", event.target.value)} /></FinanceField>
          <FinanceField label="PO Number *"><Input value={form.po_number} onChange={(event) => setField("po_number", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Contact Person"><Input value={form.shipping_contact_person} onChange={(event) => setField("shipping_contact_person", event.target.value)} /></FinanceField>
          <FinanceField label="Delivery Period *"><Input type="date" value={form.delivery_period} onChange={(event) => setField("delivery_period", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Country"><Input value={form.shipping_country} onChange={(event) => setField("shipping_country", event.target.value)} /></FinanceField>
          <FinanceField label="Installation/Service Details"><FinanceTextarea value={form.installation_details} onChange={(event) => setField("installation_details", event.target.value)} /></FinanceField>
          <FinanceField label="Account"><Input value={form.account_name} onChange={(event) => setField("account_name", event.target.value)} /></FinanceField>
          <FinanceField label="Technology Segment">
            <FinanceSelect value={form.technology_segment} onChange={(event) => setField("technology_segment", event.target.value)}>
              <option value="">None</option>
              {SEGMENTS.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Sub Technology Segment">
            <FinanceSelect value={form.sub_technology_segment} onChange={(event) => setField("sub_technology_segment", event.target.value)}>
              <option value="">None</option>
              {SUB_SEGMENTS.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="OVF sent to SCM team">
            <Input value={ovf?.shared_to_scm ? "Yes" : "No"} disabled />
          </FinanceField>
        </div>
      </CrmSection>

      <OvfOrderLinesSection
        customerRows={customerRows}
        vendorRows={vendorRows}
        onCustomerRowsChange={setCustomerRows}
        onVendorRowsChange={setVendorRows}
        disabled={saving}
        onValidationError={setError}
      />

      <CrmSection title="Charges and Details" icon={IndianRupee}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Total Margin in Amount">
            <Input
              type="number"
              step="0.01"
              className={`${NUMBER_NO_SPIN} cursor-default bg-muted/50`}
              value={Number.isFinite(totalMarginAmount) ? totalMarginAmount.toFixed(2) : "0.00"}
              disabled
              title="Customer − Vendor − Freight − Finance Cost"
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
              type="number"
              step="0.001"
              className={`${NUMBER_NO_SPIN} cursor-default bg-muted/50`}
              value={Number.isFinite(totalMarginPct) ? totalMarginPct.toFixed(3) : "0.000"}
              disabled
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
          <FinanceField label="Opportunity">
            <Input value={opportunity?.opportunity_name ?? "-"} disabled />
          </FinanceField>
          <FinanceField label="Freight Charges (₹)">
            <Input
              type="number"
              min={0}
              step="0.01"
              className={NUMBER_NO_SPIN}
              value={form.freight}
              onChange={(event) => setField("freight", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Approval Status">
            <FinanceSelect
              value={form.approval_status}
              onChange={(event) => setField("approval_status", event.target.value)}
            >
              <option value="not_required">None</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Finance Cost (%)">
            <Input
              type="number"
              min={0}
              step="0.001"
              className={NUMBER_NO_SPIN}
              value={form.finance_cost_pct}
              onChange={(event) => setField("finance_cost_pct", event.target.value)}
            />
          </FinanceField>
          <FinanceField label="Additional Charges (₹)">
            <Input
              type="number"
              min={0}
              step="0.01"
              className={NUMBER_NO_SPIN}
              value={form.additional_charges}
              onChange={(event) => setField("additional_charges", event.target.value)}
            />
          </FinanceField>
        </div>
      </CrmSection>
      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
