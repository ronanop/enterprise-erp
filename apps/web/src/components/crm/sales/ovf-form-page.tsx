"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  createOvf,
  formatInrPrecise,
  fullName,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getQuote,
  listContacts,
  listEmployeeOptions,
  listOvfs,
  type Opportunity,
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
};

const SEGMENTS = ["Hardware", "Software", "Services", "Cloud", "Networking", "Security"];
const SUB_SEGMENTS = ["Compute", "Storage", "Licensing", "Implementation", "Support", "Managed Services"];

export function OvfFormPage({ quoteId }: { quoteId: string }) {
  const router = useRouter();
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
    vendor_payment_days: "0",
    customer_payment_days: "0",
    freight: "0",
    additional_charges: "0",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const quoteRow = await getQuote(quoteId);
      const opportunityRow = await getOpportunity(quoteRow.opportunity_id);
      const [companyRow, contactRows, employeeRows, blueprint, existingOvfs] = await Promise.all([
        opportunityRow.company_account_id
          ? getCompany(opportunityRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
        opportunityRow.company_account_id
          ? listContacts(opportunityRow.company_account_id).catch(() => [])
          : Promise.resolve([]),
        listEmployeeOptions().catch(() => []),
        getOpportunityBlueprint(quoteRow.opportunity_id).catch(() => null),
        listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
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
        freight: String(quoteRow.freight ?? 0),
      }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF details");
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField<K extends keyof OvfDraft>(key: K, value: OvfDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const financeCost = useMemo(() => {
    const gap = Math.max(
      0,
      (Number(form.customer_payment_days) || 0) - (Number(form.vendor_payment_days) || 0),
    );
    return gap ? Math.ceil(gap / 15) * 0.5 : 0;
  }, [form.customer_payment_days, form.vendor_payment_days]);

  async function onSave() {
    if (!quote || !opportunity) return;
    if (!form.po_number.trim()) {
      setError("PO Number is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ovf = await createOvf({
        quote_id: quote.id,
        branch_id: opportunity.branch_id,
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
        freight: Number(form.freight) || 0,
        additional_charges: Number(form.additional_charges) || 0,
      });
      router.push(`/crm/ovf/${ovf.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create OVF");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/60" />;
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/crm/opportunities/${opportunity?.id ?? ""}`}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
      >
        <ArrowLeft className="size-3.5" /> Opportunity
      </Link>
      <PageHeader
        title="Create OVF Module"
        description="OVF details are prefilled from the accepted Quote, Opportunity, and Company."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/crm/opportunities/${opportunity?.id ?? ""}`}
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
      <SyncedBanner from="Company → Opportunity → Quote" />
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">OVF Module Information</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Customer Name"><Input value={form.customer_name} onChange={(event) => setField("customer_name", event.target.value)} /></FinanceField>
          <FinanceField label="Quote Name"><Input value={form.quote_name} onChange={(event) => setField("quote_name", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Address"><Input value={form.billing_address} onChange={(event) => setField("billing_address", event.target.value)} /></FinanceField>
          <FinanceField label="Quote No"><Input value={quote?.quote_no ?? "-"} disabled /></FinanceField>
          <FinanceField label="Billing State"><Input value={form.billing_state} onChange={(event) => setField("billing_state", event.target.value)} /></FinanceField>
          <FinanceField label="OVF Module Owner"><Input value={form.owner_name} onChange={(event) => setField("owner_name", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Contact Person"><Input value={form.billing_contact_person} onChange={(event) => setField("billing_contact_person", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Address"><Input value={form.shipping_address} onChange={(event) => setField("shipping_address", event.target.value)} /></FinanceField>
          <FinanceField label="Billing Country"><Input value={form.billing_country} onChange={(event) => setField("billing_country", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping State"><Input value={form.shipping_state} onChange={(event) => setField("shipping_state", event.target.value)} /></FinanceField>
          <FinanceField label="PO Number *"><Input value={form.po_number} onChange={(event) => setField("po_number", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Contact Person"><Input value={form.shipping_contact_person} onChange={(event) => setField("shipping_contact_person", event.target.value)} /></FinanceField>
          <FinanceField label="Delivery Period"><Input type="date" value={form.delivery_period} onChange={(event) => setField("delivery_period", event.target.value)} /></FinanceField>
          <FinanceField label="Shipping Country"><Input value={form.shipping_country} onChange={(event) => setField("shipping_country", event.target.value)} /></FinanceField>
          <FinanceField label="Installation/Service Details"><FinanceTextarea value={form.installation_details} onChange={(event) => setField("installation_details", event.target.value)} /></FinanceField>
          <FinanceField label="Account"><Input value={form.account_name} onChange={(event) => setField("account_name", event.target.value)} /></FinanceField>
          <FinanceField label="OVF sent to SCM team"><Input value="No" disabled /></FinanceField>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Technology Segment &amp; Sub Technology Segment</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
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
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium">Charges and Details</h2>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Total Margin in Amount"><Input value={formatInrPrecise(quote?.total_margin_amount ?? 0)} disabled /></FinanceField>
          <FinanceField label="Vendor Payments Terms"><Input type="number" min={0} value={form.vendor_payment_days} onChange={(event) => setField("vendor_payment_days", event.target.value)} /></FinanceField>
          <FinanceField label="Total Margin in Percentage"><Input value={`${Number(quote?.avg_margin_pct ?? 0).toFixed(3)}%`} disabled /></FinanceField>
          <FinanceField label="Customer Payment Term"><Input type="number" min={0} value={form.customer_payment_days} onChange={(event) => setField("customer_payment_days", event.target.value)} /></FinanceField>
          <FinanceField label="Opportunity"><Input value={opportunity?.opportunity_name ?? "-"} disabled /></FinanceField>
          <FinanceField label="Freight Charges (₹)"><Input type="number" min={0} value={form.freight} onChange={(event) => setField("freight", event.target.value)} /></FinanceField>
          <FinanceField label="Approval Status"><Input value="None" disabled /></FinanceField>
          <FinanceField label="Finance Cost (%)"><Input value={financeCost.toFixed(3)} disabled /></FinanceField>
          <FinanceField label="Additional Charges (₹)"><Input type="number" min={0} value={form.additional_charges} onChange={(event) => setField("additional_charges", event.target.value)} /></FinanceField>
        </div>
      </section>
    </div>
  );
}
