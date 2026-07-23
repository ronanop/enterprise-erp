"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { AttachmentsPanel } from "@/components/crm/sales/attachments-panel";
import { BlueprintActions, BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline, type DealStage } from "@/components/crm/sales/deal-timeline";
import { QuoteLineTable } from "@/components/crm/sales/quote-line-table";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  applyQuoteAction,
  approveQuoteInternally,
  formatInr,
  formatInrPrecise,
  fullName,
  getCompany,
  getOpportunity,
  getQuote,
  getQuoteBlueprint,
  getQuoteMargin,
  getSalesLead,
  listAttachments,
  listContacts,
  listEmployeeOptions,
  listQuoteLines,
  listOvfs,
  sendQuoteForApproval,
  type BlueprintActionPayload,
  type BlueprintState,
  type Company,
  type Contact,
  type Opportunity,
  type Option,
  type Ovf,
  type Quote,
  type QuoteLine,
  type QuoteMarginSummary,
  type SalesLead,
} from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function QuoteDetailPage({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [margin, setMargin] = useState<QuoteMarginSummary | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [sourceLead, setSourceLead] = useState<SalesLead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [existingOvf, setExistingOvf] = useState<Ovf | null>(null);
  const [hasVendorQuote, setHasVendorQuote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [quoteRow, bp, marginRow, lineRows, attachmentRows] = await Promise.all([
        getQuote(quoteId),
        getQuoteBlueprint(quoteId),
        getQuoteMargin(quoteId).catch(() => null),
        listQuoteLines(quoteId).catch(() => []),
        listAttachments("quote", quoteId).catch(() => []),
      ]);
      setQuote(quoteRow);
      setBlueprint(bp);
      setMargin(marginRow);
      setLines(lineRows);
      setHasVendorQuote(attachmentRows.some((row) => row.category === "vendor_quote"));
      const [opp, ovfRows, companyRow, employeeRows] = await Promise.all([
        getOpportunity(quoteRow.opportunity_id).catch(() => null),
        listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
        quoteRow.company_account_id
          ? getCompany(quoteRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setOpportunity(opp);
      setCompany(companyRow);
      setEmployees(employeeRows);
      setSourceLead(
        opp?.lead_id ? await getSalesLead(opp.lead_id).catch(() => null) : null,
      );
      setContacts(
        opp?.company_account_id
          ? await listContacts(opp.company_account_id).catch(() => [] as Contact[])
          : [],
      );
      setExistingOvf(ovfRows[0] ?? null);
    } catch (err) {
      setQuote(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onBlueprintAction(action: string, payload: BlueprintActionPayload) {
    setBusy(true);
    setError(null);
    try {
      if (action === "send_for_approval") {
        await sendQuoteForApproval(quoteId, { team_role: payload.team_role, remarks: payload.remarks });
      } else if (action === "approve_internally") {
        await approveQuoteInternally(quoteId, { remark: payload.remark });
      } else {
        await applyQuoteAction(quoteId, action, payload);
      }
      setBanner({ text: `Action "${action.replaceAll("_", " ")}" applied.`, tone: "success" });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : `Failed to ${action}`;
      setBanner({ text: message, tone: "error" });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (loading && !quote) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="space-y-3">
        <Link href="/crm/quotes" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Quotes
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!quote || !blueprint) return null;

  const lost = blueprint.state === "lost";
  const readOnlyLines = quote.locked || ["accepted", "lost", "sent_to_customer", "negotiation", "follow_up"].includes(quote.quote_stage);
  const nearingSubmit = blueprint.allowed_actions.includes("send_for_approval") && !hasVendorQuote;
  const timelineStage: DealStage = existingOvf?.deal_won ? "won" : existingOvf ? "ovf" : "quote";
  const contact =
    contacts.find((row) => row.id === quote.contact_id) ??
    contacts.find((row) => row.is_primary) ??
    contacts[0];
  const ownerFromEmployee = opportunity?.owner_employee_id
    ? employees.find((row) => row.id === opportunity.owner_employee_id)?.label
    : undefined;
  const projectTitle =
    quote.project_title || opportunity?.project_title || opportunity?.opportunity_name || null;
  const accountName = quote.account_name || company?.customer_name || null;
  const serviceType = quote.service_type || sourceLead?.product_type || null;
  const ownerName = quote.owner_name || ownerFromEmployee || null;
  const contactName = contact ? fullName(contact) : "—";
  const entityName = quote.entity_name || sourceLead?.entity_name || company?.customer_name || null;
  const entityEmail =
    quote.entity_email || sourceLead?.entity_email || company?.customer_email || null;
  const entityAddress =
    quote.entity_address ||
    sourceLead?.entity_address ||
    [
      company?.billing_street,
      company?.billing_city,
      company?.billing_state,
      company?.billing_code,
      company?.billing_country,
    ]
      .filter(Boolean)
      .join(", ") ||
    null;
  const entityGst = quote.entity_gst || sourceLead?.entity_gst || null;
  const entityContact =
    quote.entity_contact || sourceLead?.entity_contact || company?.phone || null;
  const billingCountry =
    quote.billing_country || company?.billing_country || sourceLead?.country || null;
  const shippingCountry =
    quote.shipping_country || company?.shipping_country || company?.billing_country || null;
  const description =
    quote.description || sourceLead?.notes || company?.description || null;
  const timelineLinks = {
    ...(opportunity?.company_account_id
      ? { company: `/crm/companies/${opportunity.company_account_id}` }
      : {}),
    ...(opportunity?.lead_id ? { lead: `/crm/leads/${opportunity.lead_id}` } : {}),
    opportunity: `/crm/opportunities/${quote.opportunity_id}`,
    quote: `/crm/quotes/${quote.id}`,
    ...(existingOvf ? { ovf: `/crm/ovf/${existingOvf.id}` } : {}),
    ...(existingOvf?.deal_won ? { won: `/crm/ovf/${existingOvf.id}` } : {}),
  };
  const nextStep = existingOvf
    ? {
        label: existingOvf.deal_won ? "Review Won Deal" : "Continue OVF",
        description: existingOvf.deal_won
          ? "The deal is complete. Review its final OVF and value."
          : "Continue approval, SCM sharing, and Deal Won on the OVF.",
        href: `/crm/ovf/${existingOvf.id}`,
      }
    : quote.quote_stage === "accepted"
      ? {
          label: "Attach Customer PO",
          description: "The quote is accepted. Continue on the opportunity to attach and approve the customer PO.",
          href: `/crm/opportunities/${quote.opportunity_id}`,
        }
      : {
          label: "Complete Quote",
          description: "Use the quote actions and line editor on this screen to advance the deal.",
        };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/crm/quotes" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
          <ArrowLeft className="size-3.5" /> Quotes
        </Link>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <DealTimeline current={timelineStage} lost={lost} links={timelineLinks} nextStep={nextStep} />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={quote.approval_status} label="This quote" />

      <PageHeader
        title={`${quote.quote_no}${quote.quote_revision > 1 ? ` (Rev ${quote.quote_revision})` : ""}`}
        description={quote.subject ?? "Customer quotation"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FinanceStatusBadge status={quote.approval_status} />
            <BlueprintStateBadge state={blueprint.state} />
          </div>
        }
      />

      {opportunity ? (
        <p className="text-xs text-muted-foreground">
          For opportunity{" "}
          <Link
            href={`/crm/opportunities/${opportunity.id}`}
            className="cursor-pointer font-medium text-primary underline underline-offset-2"
          >
            {opportunity.opportunity_name}
          </Link>
        </p>
      ) : null}

      {banner ? (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            banner.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {banner.text}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">{error}</div>
      ) : null}

      {nearingSubmit ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          No vendor quote attached yet — attach it below before sending this quote for approval.
        </div>
      ) : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        excludeActions={
          margin?.requires_management_approval && !blueprint.locked
            ? ["approve_internally"]
            : undefined
        }
        onAction={onBlueprintAction}
        disabled={busy}
      />
      {margin?.requires_management_approval &&
      blueprint.allowed_actions.includes("approve_internally") &&
      !blueprint.locked ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Margin is below the management threshold. Send for approval via My Jobs instead of approving
          internally.
        </div>
      ) : null}

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Grand Total</dt>
          <dd className="mt-0.5 text-sm font-medium">{formatInrPrecise(quote.grand_total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Avg Margin</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {quote.avg_margin_pct}%{" "}
            {margin?.requires_management_approval ? (
              <span className="text-destructive">(below {margin.required_threshold_pct}% threshold)</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total Margin Amount</dt>
          <dd className="mt-0.5 text-sm">{formatInrPrecise(quote.total_margin_amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Freight</dt>
          <dd className="mt-0.5 text-sm">{formatInr(quote.freight)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Valid Until</dt>
          <dd className="mt-0.5 text-sm">{quote.valid_until ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reason for Discount</dt>
          <dd className="mt-0.5 text-sm">{quote.reason_for_discount ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Version</dt>
          <dd className="mt-0.5 text-sm">{quote.version}</dd>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium tracking-tight">Quote Details</h2>

        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Quote Information
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Customer's Project Title">{textOrDash(projectTitle)}</DetailItem>
          <DetailItem label="Subject">{textOrDash(quote.subject || projectTitle)}</DetailItem>
          <DetailItem label="Account Name">{textOrDash(accountName)}</DetailItem>
          <DetailItem label="Valid Until">{textOrDash(quote.valid_until)}</DetailItem>
          <DetailItem label="Contact Name">{contactName}</DetailItem>
          <DetailItem label="Quote Owner">{textOrDash(ownerName)}</DetailItem>
          <DetailItem label="Service Type">{textOrDash(serviceType)}</DetailItem>
          <DetailItem label="Quote No.">{quote.quote_no}</DetailItem>
          <DetailItem label="Quote Stage">
            <span className="capitalize">{quote.quote_stage.replaceAll("_", " ")}</span>
          </DetailItem>
          <DetailItem label="Quote Revision">{quote.quote_revision}</DetailItem>
          <DetailItem label="Approval Status">
            <FinanceStatusBadge status={quote.approval_status} />
          </DetailItem>
          <DetailItem label="Sales Order ID">
            {textOrDash(quote.sales_order_id ?? opportunity?.sales_order_id)}
          </DetailItem>
        </dl>

        <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Entity Information
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Entity Name">{textOrDash(entityName)}</DetailItem>
          <DetailItem label="Entity Address">
            <span className="whitespace-pre-wrap">{textOrDash(entityAddress)}</span>
          </DetailItem>
          <DetailItem label="Entity Contact Number">{textOrDash(entityContact)}</DetailItem>
          <DetailItem label="Entity Email">{textOrDash(entityEmail)}</DetailItem>
          <DetailItem label="Entity GST No.">{textOrDash(entityGst)}</DetailItem>
          <DetailItem label="Billing Country">{textOrDash(billingCountry)}</DetailItem>
          <DetailItem label="Shipping Country">{textOrDash(shippingCountry)}</DetailItem>
        </dl>

        <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Commercial Terms
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Freight Charges (₹)">{formatInr(quote.freight)}</DetailItem>
          <DetailItem label="Grand Total">{formatInrPrecise(quote.grand_total)}</DetailItem>
          <DetailItem label="Avg Margin">{quote.avg_margin_pct}%</DetailItem>
          <DetailItem label="Total Margin Amount">{formatInrPrecise(quote.total_margin_amount)}</DetailItem>
          <DetailItem label="Description">
            <span className="whitespace-pre-wrap">{textOrDash(description)}</span>
          </DetailItem>
          <DetailItem label="Reason For Discount">
            <span className="whitespace-pre-wrap">{textOrDash(quote.reason_for_discount)}</span>
          </DetailItem>
          <DetailItem label="Terms and Conditions">
            <span className="whitespace-pre-wrap">{textOrDash(quote.terms)}</span>
          </DetailItem>
        </dl>
      </section>

      <QuoteLineTable
        quoteId={quote.id}
        lines={lines}
        readOnly={readOnlyLines}
        initialDraft={{
          product_name:
            sourceLead?.sub_product ||
            sourceLead?.sub_product_other ||
            sourceLead?.sub_product_category ||
            "",
          line_type: ["hardware", "software", "services"].includes(sourceLead?.product_type ?? "")
            ? sourceLead?.product_type ?? "hardware"
            : "hardware",
        }}
        onChanged={() => void load()}
      />

      <AttachmentsPanel
        entityType="quote"
        entityId={quote.id}
        branchId={quote.branch_id}
        companyId={quote.company_id}
        title="Vendor Quote & Supporting Documents"
        categories={["vendor_quote", "customer_po", "other"]}
        readOnly={quote.locked}
        onChanged={(rows) => setHasVendorQuote(rows.some((r) => r.category === "vendor_quote"))}
      />
    </div>
  );
}
