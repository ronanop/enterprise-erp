"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, IndianRupee, RefreshCw, Trophy } from "lucide-react";

import {
  CrmDetailGrid,
  CrmDetailItem,
  CrmErrorBanner,
  CrmPage,
  CrmSection,
} from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CrmEntityRejectionAlert } from "@/components/crm/sales/crm-approval-inbox-listener";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { CrmDetailEditLink } from "@/components/crm/sales/crm-detail-edit-link";
import { OvfStockSuggestions } from "@/components/crm/sales/ovf-stock-suggestions";
import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import {
  OvfOrderLinesSection,
  buildAdditionalChargeVerticals,
  computeOvfMargins,
  customerRowsFromOvfLines,
  mergeCustomerRowsWithPoAttachments,
  mergeVendorRowsWithQuoteAttachments,
  sumLineTotals,
  vendorRowsFromOvfLines,
  supportingRowsFromOvfLines,
  serviceRowsFromOvfLines,
  type CustomerChargeRow,
  type SupportingItemRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  buildOvfPrintPdfAttachment,
  cloneOvfRecord,
  downloadOvfExport,
  printOvfPreview,
} from "@/lib/crm/crm-record-actions";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { loadCrmDistributorOptions } from "@/lib/crm/lead-distributor-options";
import { ApiClientError } from "@/services/api-client";
import {
  applyOvfAction,
  deleteOvf,
  formatInr,
  formatInrPrecise,
  getOpportunity,
  getOvf,
  getOvfBlueprint,
  getQuote,
  getSalesLead,
  listAttachments,
  listOvfLines,
  listQuoteLines,
  markOvfDealWon,
  sendOvfForApproval,
  shareOvfToScm,
  type BlueprintActionPayload,
  type BlueprintState,
  type Opportunity,
  type Ovf,
  type Quote,
} from "@/services/sales-crm-service";

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
}

export function OvfDetailPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [customerRows, setCustomerRows] = useState<CustomerChargeRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorChargeRow[]>([]);
  const [supportingRows, setSupportingRows] = useState<SupportingItemRow[]>([]);
  const [serviceChargeTotal, setServiceChargeTotal] = useState(0);
  const [vendorNameOptions, setVendorNameOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);
  const [busy, setBusy] = useState(false);

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

      const [quoteRow, oppRow, quoteLines, attachments] = await Promise.all([
        getQuote(ovfRow.quote_id).catch(() => null),
        getOpportunity(ovfRow.opportunity_id).catch(() => null),
        listQuoteLines(ovfRow.quote_id).catch(() => []),
        listAttachments("ovf", ovfId).catch(() => []),
      ]);
      const poAttachments = attachments.filter((row) => row.category === "customer_po");
      const quoteAttachments = attachments.filter((row) => row.category === "vendor_quote");
      setQuote(quoteRow);
      setOpportunity(oppRow);
      setCustomerRows(
        mergeCustomerRowsWithPoAttachments(
          customerRowsFromOvfLines(ovfLines, quoteLines),
          poAttachments,
        ),
      );
      setVendorRows(
        mergeVendorRowsWithQuoteAttachments(
          vendorRowsFromOvfLines(ovfLines, quoteLines),
          quoteAttachments,
        ),
      );
      setSupportingRows(supportingRowsFromOvfLines(ovfLines));
      setServiceChargeTotal(sumLineTotals(serviceRowsFromOvfLines(ovfLines)));
      if (oppRow?.lead_id) {
        const lead = await getSalesLead(oppRow.lead_id).catch(() => null);
        setVendorNameOptions(await loadCrmDistributorOptions(lead?.distributor_name));
      } else {
        setVendorNameOptions(await loadCrmDistributorOptions(null));
      }
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
        const assignedUserId =
          typeof payload.assigned_user_id === "string" ? payload.assigned_user_id : undefined;
        const assignedUserIds = Array.isArray(payload.assigned_user_ids)
          ? payload.assigned_user_ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
          : [];
        if (!assignedUserId && assignedUserIds.length === 0) {
          throw new ApiClientError("Select an approver before sending for approval.", 400);
        }
        const current = ovf;
        let ovfPdf: { filename: string; base64: string } | null = null;
        if (current) {
          try {
            ovfPdf = await buildOvfPrintPdfAttachment({
              ovf: current,
              quote,
              opportunity,
              customerName: textOrDash(current.customer_name),
              accountName: textOrDash(current.account_name),
              quoteName: textOrDash(current.quote_name),
              ownerName: textOrDash(current.owner_name),
              billingAddress: textOrDash(current.billing_address),
              billingState: textOrDash(current.billing_state),
              billingCountry: textOrDash(current.billing_country),
              billingContact: textOrDash(current.billing_contact_person),
              shippingAddress: textOrDash(current.shipping_address),
              shippingState: textOrDash(current.shipping_state),
              shippingCountry: textOrDash(current.shipping_country),
              shippingContact: textOrDash(current.shipping_contact_person),
              customerRows,
              vendorRows,
              supportingRows,
            });
          } catch {
            ovfPdf = null;
          }
        }
        await sendOvfForApproval(ovfId, {
          team_role: payload.team_role,
          remarks: payload.remarks,
          assigned_user_id: assignedUserId ?? assignedUserIds[0],
          assigned_user_ids: assignedUserIds.length > 0 ? assignedUserIds : assignedUserId ? [assignedUserId] : undefined,
          ovf_pdf_base64: ovfPdf?.base64 ?? null,
          ovf_pdf_filename: ovfPdf?.filename ?? null,
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

  // Snapshot fields saved on the OVF at create/edit — do not live-fallback to company/quote.
  const customerName = textOrDash(ovf.customer_name);
  const quoteName = textOrDash(ovf.quote_name);
  const accountName = textOrDash(ovf.account_name);
  const ownerName = textOrDash(ovf.owner_name);
  const billingAddress = textOrDash(ovf.billing_address);
  const billingState = textOrDash(ovf.billing_state);
  const billingCountry = textOrDash(ovf.billing_country);
  const billingContact = textOrDash(ovf.billing_contact_person);
  const shippingAddress = textOrDash(ovf.shipping_address);
  const shippingState = textOrDash(ovf.shipping_state);
  const shippingCountry = textOrDash(ovf.shipping_country);
  const shippingContact = textOrDash(ovf.shipping_contact_person);
  // Server margin also deducts additional charges and credits the early-payment discount.
  const supportingTotal = sumLineTotals(supportingRows);
  const additionalChargeRows = buildAdditionalChargeVerticals({
    supportingTotal,
    serviceVisitsTotal: serviceChargeTotal,
    recordedAdditional: ovf.additional_charges,
  });
  const fallbackMargins = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: ovf.freight,
    financeCostPct: ovf.finance_cost_pct,
  });
  const fallbackMarginAmount =
    fallbackMargins.totalMarginAmount -
    (Number(ovf.additional_charges) || supportingTotal + serviceChargeTotal || 0);
  const totalMarginAmount = Number(ovf.total_margin_amount ?? fallbackMarginAmount);
  const totalMarginPct = Number(
    ovf.total_margin_pct ??
    (fallbackMargins.totalSaleValue
      ? (fallbackMarginAmount / fallbackMargins.totalSaleValue) * 100
      : 0),
  );
  const totalSaleValue = sumLineTotals(customerRows);

  async function onPrintPreview() {
    await printOvfPreview({
      ovf,
      quote,
      opportunity,
      customerName,
      accountName,
      quoteName,
      ownerName,
      billingAddress,
      billingState,
      billingCountry,
      billingContact,
      shippingAddress,
      shippingState,
      shippingCountry,
      shippingContact,
      customerRows,
      vendorRows,
      supportingRows,
    });
  }

  async function onExport() {
    await downloadOvfExport({
      ovf,
      quote,
      opportunity,
      customerName,
      accountName,
      quoteName,
      ownerName,
      billingAddress,
      billingState,
      billingCountry,
      billingContact,
      shippingAddress,
      shippingState,
      shippingCountry,
      shippingContact,
      customerRows,
      vendorRows,
      supportingRows,
    });
  }

  return (
    <CrmPage>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/crm/ovf"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
        >
          <ArrowLeft className="size-3.5" /> OVF
        </Link>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <CrmEntityRejectionAlert entityType="ovf" entityId={ovf.id} />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={blueprint.state} label="This OVF" />

      {ovf.deal_won ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
          <Trophy className="size-4" /> Deal Won at {formatInr(ovf.deal_won_amount ?? 0)} - the opportunity is now
          closed-won.
        </div>
      ) : null}

      <PageHeader
        title={formatCrmCode(ovf.ovf_no)}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {blueprint.state === "draft" && !blueprint.locked ? (
              <CrmDetailEditLink href={`/crm/ovf/${ovf.id}/edit`} />
            ) : null}
            <CrmRecordActionsMenu
              entityType="ovf"
              entityId={ovf.id}
              entityLabel="OVF"
              entityName={formatCrmCode(ovf.ovf_no)}
              shareTitle={formatCrmCode(ovf.ovf_no)}
              onClone={() => cloneOvfRecord()}
              onPrintPreview={onPrintPreview}
              onExport={onExport}
              onDelete={() => deleteOvf(ovf.id)}
              onDeleted={() =>
                router.push(
                  opportunity ? `/crm/opportunities/${opportunity.id}` : "/crm/ovf",
                )
              }
            />
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

      {banner ? <CrmErrorBanner>{banner.text}</CrmErrorBanner> : null}
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <BlueprintActions
        allowedActions={
          ovf.shared_to_scm || ovf.deal_won
            ? []
            : blueprint.allowed_actions.filter((action) => action !== "deal_won")
        }
        locked={blueprint.locked}
        entityType="ovf"
        currentStageLabel={resolveSalesStageLabel({
          entityType: "ovf",
          blueprintState: blueprint.state,
          locked: blueprint.locked,
          ovf,
        })}
        showDealWonBadge={
          Boolean(ovf.deal_won) ||
          String(opportunity?.status || "").toLowerCase() === "won" ||
          quote?.quote_stage === "accepted"
        }
        defaultValues={{
          deal_won_amount: totalSaleValue > 0 ? totalSaleValue : null,
        }}
        onAction={onBlueprintAction}
        disabled={busy}
      />

      <CrmSection title="OVF Module Information" icon={ClipboardCheck}>
        <CrmDetailGrid>
          <CrmDetailItem label="Customer Name">{customerName}</CrmDetailItem>
          <CrmDetailItem label="Quote Name">{quoteName}</CrmDetailItem>
          <CrmDetailItem label="Billing Address">
            <span className="whitespace-pre-wrap">{billingAddress}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Quote No">
            {textOrDash(formatCrmCode(quote?.quote_no) || null)}
          </CrmDetailItem>
          <CrmDetailItem label="Billing State">{billingState}</CrmDetailItem>
          <CrmDetailItem label="OVF Module Owner">{ownerName}</CrmDetailItem>
          <CrmDetailItem label="Billing Contact Person">{billingContact}</CrmDetailItem>
          <CrmDetailItem label="Shipping Address">
            <span className="whitespace-pre-wrap">{shippingAddress}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Billing Country">{billingCountry}</CrmDetailItem>
          <CrmDetailItem label="Shipping State">{shippingState}</CrmDetailItem>
          <CrmDetailItem label="PO Number">{textOrDash(ovf.po_number)}</CrmDetailItem>
          <CrmDetailItem label="Customer PO Date">
            {ovf.po_date ? String(ovf.po_date).slice(0, 10) : "-"}
          </CrmDetailItem>
          <CrmDetailItem label="Shipping Contact Person">{shippingContact}</CrmDetailItem>
          <CrmDetailItem label="Shipping Country">{shippingCountry}</CrmDetailItem>
          <CrmDetailItem label="OVF sent to SCM team">{ovf.shared_to_scm ? "Yes" : "No"}</CrmDetailItem>
          <CrmDetailItem label="Installation/Service Details">
            <span className="whitespace-pre-wrap">{textOrDash(ovf.installation_details)}</span>
          </CrmDetailItem>
        </CrmDetailGrid>
      </CrmSection>

      <CrmSection title="Charges and Details" icon={IndianRupee}>
        <CrmDetailGrid>
          <CrmDetailItem label="Total Margin in Amount">
            {formatInrPrecise(totalMarginAmount)}
          </CrmDetailItem>
          <CrmDetailItem label="Vendor Payments Terms">{ovf.vendor_payment_days}</CrmDetailItem>
          <CrmDetailItem label="Total Margin in Percentage">
            {totalMarginPct.toFixed(2)}%
          </CrmDetailItem>
          <CrmDetailItem label="Customer Payment Term">{ovf.customer_payment_days}</CrmDetailItem>
          <CrmDetailItem label="Freight Charges (₹)">{formatInr(ovf.freight)}</CrmDetailItem>
          <CrmDetailItem label="Finance Cost (%)">{ovf.finance_cost_pct}%</CrmDetailItem>
          <CrmDetailItem label="Additional Charges (₹)">
            {formatInr(ovf.additional_charges)}
          </CrmDetailItem>
        </CrmDetailGrid>
      </CrmSection>

      <OvfStockSuggestions ovf={ovf} />

      <OvfOrderLinesSection
        customerRows={customerRows}
        vendorRows={vendorRows}
        vendorNameOptions={vendorNameOptions}
        supportingRows={supportingRows}
        supportingDescription={
          supportingRows.map((row) => row.description.trim()).find(Boolean) ?? ""
        }
        additionalChargeRows={additionalChargeRows}
        disabled
      />
    </CrmPage>
  );
}
