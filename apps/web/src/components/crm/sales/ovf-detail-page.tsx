"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Download, IndianRupee, Pencil, Trophy } from "lucide-react";

import {
  CrmErrorBanner,
  CrmHeadlineBand,
  CrmHeadlineStat,
  CrmPage,
  CrmSection,
} from "@/components/crm/crm-ui";
import {
  CrmReadOnlyField,
  CrmReadOnlyTextarea,
  textOrDash,
} from "@/components/crm/sales/crm-readonly-field";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline, DealTimelineStatusBadge } from "@/components/crm/sales/deal-timeline";
import {
  OvfOrderLinesSection,
  customerRowsFromOvfLines,
  vendorRowsFromOvfLines,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { exportOvfPdf } from "@/lib/crm/export-ovf-pdf";
import { ApiClientError } from "@/services/api-client";
import {
  applyOvfAction,
  formatInr,
  formatInrPrecise,
  getCompany,
  getOpportunity,
  getOvf,
  getOvfBlueprint,
  getQuote,
  listCrmMemberOptions,
  listOvfLines,
  markOvfDealWon,
  sendOvfForApproval,
  shareOvfToScm,
  type BlueprintActionPayload,
  type BlueprintState,
  type Company,
  type Opportunity,
  type Option,
  type Ovf,
  type Quote,
} from "@/services/sales-crm-service";

function formatOvfApprovalStatus(status: string): string {
  const map: Record<string, string> = {
    not_required: "None",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[status] ?? status.replaceAll("_", " ");
}

export function OvfDetailPage({ ovfId }: { ovfId: string }) {
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerChargeRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovfRow, bp, ovfLines] = await Promise.all([
        getOvf(ovfId),
        getOvfBlueprint(ovfId),
        listOvfLines(ovfId).catch(() => []),
      ]);
      setOvf(ovfRow);
      setBlueprint(bp);
      setCustomerRows(customerRowsFromOvfLines(ovfLines));
      setVendorRows(vendorRowsFromOvfLines(ovfLines));

      const [quoteRow, oppRow, employeeRows] = await Promise.all([
        getQuote(ovfRow.quote_id).catch(() => null),
        getOpportunity(ovfRow.opportunity_id).catch(() => null),
        listCrmMemberOptions().catch(() => [] as Option[]),
      ]);
      setQuote(quoteRow);
      setOpportunity(oppRow);
      setEmployees(employeeRows);

      const accountId = ovfRow.company_account_id ?? oppRow?.company_account_id ?? null;
      setCompany(accountId ? await getCompany(accountId).catch(() => null) : null);
    } catch (err) {
      setOvf(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF");
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onBlueprintAction(action: string, payload: BlueprintActionPayload) {
    setBusy(true);
    setError(null);
    try {
      if (action === "send_for_approval") {
        const assignedUserId = payload.assigned_user_id;
        if (typeof assignedUserId !== "string" || !assignedUserId.trim()) {
          throw new ApiClientError("Select an approver before sending for approval.", 400);
        }
        await sendOvfForApproval(ovfId, {
          team_role: typeof payload.team_role === "string" ? payload.team_role : undefined,
          assigned_user_id: assignedUserId,
          remarks: typeof payload.remarks === "string" ? payload.remarks : null,
        });
      } else if (action === "share_to_scm") {
        await shareOvfToScm(ovfId);
      } else if (action === "deal_won") {
        const amount = payload.deal_won_amount;
        if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
          throw new ApiClientError("Deal Won amount is required.", 400);
        }
        await markOvfDealWon(ovfId, Number(amount));
      } else {
        await applyOvfAction(ovfId, action, payload);
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

  if (loading && !ovf) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error && !ovf) {
    return (
      <CrmPage className="space-y-3">
        <Link href="/crm/ovf" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> OVF
        </Link>
        <CrmErrorBanner>{error}</CrmErrorBanner>
      </CrmPage>
    );
  }

  if (!ovf || !blueprint) return null;
  const ovfRecord = ovf;

  const ownerFromEmployee = opportunity?.owner_employee_id
    ? employees.find((row) => row.id === opportunity.owner_employee_id)?.label
    : undefined;
  const companyBillingAddress = [
    company?.billing_street,
    company?.billing_city,
    company?.billing_code,
  ]
    .filter(Boolean)
    .join(", ");
  const companyShippingAddress = [
    company?.shipping_street,
    company?.shipping_city,
    company?.shipping_code,
  ]
    .filter(Boolean)
    .join(", ");
  const customerName = textOrDash(
    ovf.customer_name || company?.customer_name || quote?.entity_name || quote?.account_name,
  );
  const quoteName = textOrDash(ovf.quote_name || quote?.subject || quote?.project_title);
  const accountName = textOrDash(
    ovf.account_name || company?.customer_name || quote?.account_name || quote?.entity_name,
  );
  const ownerName = textOrDash(ovf.owner_name || quote?.owner_name || ownerFromEmployee);
  const billingAddress = textOrDash(
    ovf.billing_address || quote?.entity_address || companyBillingAddress,
  );
  const billingState = textOrDash(ovf.billing_state || company?.billing_state);
  const billingCountry = textOrDash(
    ovf.billing_country || quote?.billing_country || company?.billing_country,
  );
  const billingContact = textOrDash(ovf.billing_contact_person || quote?.entity_contact);
  const shippingAddress = textOrDash(
    ovf.shipping_address || companyShippingAddress || companyBillingAddress,
  );
  const shippingState = textOrDash(
    ovf.shipping_state || company?.shipping_state || company?.billing_state,
  );
  const shippingCountry = textOrDash(
    ovf.shipping_country ||
    quote?.shipping_country ||
    company?.shipping_country ||
    company?.billing_country,
  );
  const shippingContact = textOrDash(ovf.shipping_contact_person || quote?.entity_contact);
  const timelineLinks = {
    ...(opportunity?.company_account_id
      ? { company: `/crm/companies/${opportunity.company_account_id}` }
      : {}),
    ...(opportunity?.lead_id ? { lead: `/crm/leads/${opportunity.lead_id}` } : {}),
    opportunity: `/crm/opportunities/${ovf.opportunity_id}`,
    quote: `/crm/quotes/${ovf.quote_id}`,
    ovf: `/crm/ovf/${ovf.id}`,
    ...(ovf.deal_won ? { won: `/crm/ovf/${ovf.id}` } : {}),
  };

  function onExportPdf() {
    setExporting(true);
    setError(null);
    try {
      exportOvfPdf({
        ovf: ovfRecord,
        quote,
        opportunity,
        customerName: customerName === "—" ? "-" : customerName,
        accountName: accountName === "—" ? "-" : accountName,
        quoteName: quoteName === "—" ? "-" : quoteName,
        ownerName: ownerName === "—" ? "-" : ownerName,
        billingAddress: billingAddress === "—" ? "-" : billingAddress,
        billingState: billingState === "—" ? "-" : billingState,
        billingCountry: billingCountry === "—" ? "-" : billingCountry,
        billingContact: billingContact === "—" ? "-" : billingContact,
        shippingAddress: shippingAddress === "—" ? "-" : shippingAddress,
        shippingState: shippingState === "—" ? "-" : shippingState,
        shippingCountry: shippingCountry === "—" ? "-" : shippingCountry,
        shippingContact: shippingContact === "—" ? "-" : shippingContact,
        customerRows,
        vendorRows,
        createdBy: ownerName === "—" ? null : ownerName,
        modifiedBy: ownerName === "—" ? null : ownerName,
      });
      setBanner({ text: "OVF PDF exported.", tone: "success" });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to export OVF PDF";
      setBanner({ text: message, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <CrmPage>
      <div>
        <Link
          href="/crm/ovf"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> OVF
        </Link>
      </div>

      <DealTimeline
        current={ovf.deal_won ? "won" : "ovf"}
        links={timelineLinks}
        nextStep={
          ovf.deal_won
            ? undefined
            : {
                label: "Complete OVF",
                description:
                  "Use the blueprint actions on this screen through Share to SCM and Deal Won.",
              }
        }
      />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={ovf.approval_status} label="This OVF" />

      {ovf.deal_won ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
          <Trophy className="size-4" /> Deal Won at {formatInr(ovf.deal_won_amount ?? 0)} — the opportunity is now
          closed-won.
        </div>
      ) : null}

      <PageHeader
        title={ovf.ovf_no}
        description={quote ? `From Quote ${quote.quote_no}` : "Order Value Form"}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <DealTimelineStatusBadge stage={ovf.deal_won ? "won" : "ovf"} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 cursor-pointer px-2.5 text-[0.8rem] transition-colors duration-200"
              disabled={exporting || loading}
              onClick={() => onExportPdf()}
            >
              <Download className={`size-3.5 ${exporting ? "animate-pulse" : ""}`} />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
            {!ovf.locked && !ovf.deal_won && !ovf.shared_to_scm ? (
              <Link
                href={`/crm/ovf/${ovf.id}/edit`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
              >
                <Pencil className="size-3.5" /> Edit
              </Link>
            ) : null}
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
        banner.tone === "error" ? (
          <CrmErrorBanner>{banner.text}</CrmErrorBanner>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
            {banner.text}
          </div>
        )
      ) : null}
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        defaultValues={{ deal_won_amount: quote?.grand_total ?? null }}
        onAction={onBlueprintAction}
        disabled={busy}
      />

      <CrmHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <CrmHeadlineStat label="Total Margin" value={`${ovf.total_margin_pct}%`} />
          <CrmHeadlineStat
            label="Margin Amount"
            value={formatInrPrecise(ovf.total_margin_amount)}
          />
          <CrmHeadlineStat
            label="PO Number"
            value={ovf.po_number?.trim() || "—"}
            sub={`Finance ${ovf.finance_cost_pct}%`}
          />
          <CrmHeadlineStat
            label="SCM Shared"
            value={ovf.shared_to_scm ? "Yes" : "No"}
            sub={ovf.deal_won ? `Won ${formatInr(ovf.deal_won_amount ?? 0)}` : `v${ovf.version}`}
          />
        </div>
      </CrmHeadlineBand>

      <CrmSection title="OVF Module Information" icon={ClipboardCheck}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <CrmReadOnlyField label="Customer Name" value={textOrDash(ovf.customer_name)} />
          <CrmReadOnlyField label="Quote Name" value={textOrDash(ovf.quote_name)} />
          <CrmReadOnlyField label="Billing Address" value={textOrDash(ovf.billing_address)} />
          <CrmReadOnlyField label="Quote No" value={textOrDash(quote?.quote_no)} />
          <CrmReadOnlyField label="Billing State" value={textOrDash(ovf.billing_state)} />
          <CrmReadOnlyField label="OVF Module Owner" value={textOrDash(ovf.owner_name)} />
          <CrmReadOnlyField
            label="Billing Contact Person"
            value={textOrDash(ovf.billing_contact_person)}
          />
          <CrmReadOnlyField label="Shipping Address *" value={textOrDash(ovf.shipping_address)} />
          <CrmReadOnlyField label="Billing Country" value={textOrDash(ovf.billing_country)} />
          <CrmReadOnlyField label="Shipping State" value={textOrDash(ovf.shipping_state)} />
          <CrmReadOnlyField label="PO Number *" value={textOrDash(ovf.po_number)} />
          <CrmReadOnlyField
            label="Shipping Contact Person"
            value={textOrDash(ovf.shipping_contact_person)}
          />
          <CrmReadOnlyField label="Delivery Period *" value={textOrDash(ovf.delivery_period)} />
          <CrmReadOnlyField label="Shipping Country" value={textOrDash(ovf.shipping_country)} />
          <CrmReadOnlyTextarea
            label="Installation/Service Details"
            value={textOrDash(ovf.installation_details)}
          />
          <CrmReadOnlyField label="Account" value={textOrDash(ovf.account_name)} />
          <CrmReadOnlyField
            label="Technology Segment"
            value={textOrDash(ovf.technology_segment) || "None"}
          />
          <CrmReadOnlyField
            label="Sub Technology Segment"
            value={textOrDash(ovf.sub_technology_segment) || "None"}
          />
          <CrmReadOnlyField
            label="OVF sent to SCM team"
            value={ovf.shared_to_scm ? "Yes" : "No"}
          />
        </div>
      </CrmSection>

      <OvfOrderLinesSection customerRows={customerRows} vendorRows={vendorRows} disabled />

      <CrmSection title="Charges and Details" icon={IndianRupee}>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          <CrmReadOnlyField
            label="Total Margin in Amount"
            value={formatInrPrecise(ovf.total_margin_amount)}
          />
          <CrmReadOnlyField
            label="Vendor Payments Terms"
            value={String(ovf.vendor_payment_days)}
          />
          <CrmReadOnlyField
            label="Total Margin in Percentage"
            value={`${ovf.total_margin_pct}%`}
          />
          <CrmReadOnlyField
            label="Customer Payment Term"
            value={String(ovf.customer_payment_days)}
          />
          <CrmReadOnlyField
            label="Opportunity"
            value={textOrDash(opportunity?.opportunity_name)}
          />
          <CrmReadOnlyField label="Freight Charges (?)" value={formatInr(ovf.freight)} />
          <CrmReadOnlyField
            label="Approval Status"
            value={formatOvfApprovalStatus(ovf.approval_status)}
          />
          <CrmReadOnlyField label="Finance Cost (%)" value={`${ovf.finance_cost_pct}%`} />
          <CrmReadOnlyField
            label="Additional Charges (?)"
            value={formatInr(ovf.additional_charges)}
          />
        </div>
      </CrmSection>
    </CrmPage>
  );
}
