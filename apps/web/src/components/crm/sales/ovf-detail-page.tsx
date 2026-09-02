"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, RefreshCw, Trophy } from "lucide-react";

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
import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import {
  OvfOrderLinesSection,
  computeOvfMargins,
  customerRowsFromOvfLines,
  mergeCustomerRowsWithPoAttachments,
  mergeVendorRowsWithQuoteAttachments,
  sumLineTotals,
  vendorRowsFromOvfLines,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { cloneOvfRecord, printOvfPreview } from "@/lib/crm/crm-record-actions";
import { buildLeadDistributorDropdownOptions } from "@/lib/crm/lead-distributor-options";
import {
  applyOvfAction,
  deleteOvf,
  formatInr,
  formatInrPrecise,
  getCompany,
  getOpportunity,
  getOvf,
  getOvfBlueprint,
  getQuote,
  getSalesLead,
  listAttachments,
  listEmployeeOptions,
  listMyJobs,
  listOvfLines,
  listQuoteLines,
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

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function resolveEmployeeLabel(userId: string | null | undefined, employees: Option[]): string | null {
  if (!userId) return null;
  const match = employees.find((employee) => employee.id === userId);
  return match?.label?.trim() || null;
}

async function resolveOvfApproverName(ovfId: string, employees: Option[]): Promise<string | null> {
  try {
    const tasks = await listMyJobs({ entity_type: "ovf", entity_id: ovfId, status: "approved" });
    const approveTask = tasks
      .filter((task) => task.action === "approve" && task.decided_by)
      .sort((a, b) => String(b.decided_at ?? "").localeCompare(String(a.decided_at ?? "")))[0];
    return resolveEmployeeLabel(approveTask?.decided_by, employees);
  } catch {
    return null;
  }
}

export function OvfDetailPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerChargeRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorChargeRow[]>([]);
  const [vendorNameOptions, setVendorNameOptions] = useState<string[]>([]);
  const [ovfApproverName, setOvfApproverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOvfApproverName(null);
    try {
      const [ovfRow, bp, ovfLines] = await Promise.all([
        getOvf(ovfId),
        getOvfBlueprint(ovfId),
        listOvfLines(ovfId).catch(() => []),
      ]);
      setOvf(ovfRow);
      setBlueprint(bp);

      const [quoteRow, oppRow, employeeRows, quoteLines, attachments] = await Promise.all([
        getQuote(ovfRow.quote_id).catch(() => null),
        getOpportunity(ovfRow.opportunity_id).catch(() => null),
        listEmployeeOptions().catch(() => [] as Option[]),
        listQuoteLines(ovfRow.quote_id).catch(() => []),
        listAttachments("ovf", ovfId).catch(() => []),
      ]);
      const poAttachments = attachments.filter((row) => row.category === "customer_po");
      const quoteAttachments = attachments.filter((row) => row.category === "vendor_quote");
      setQuote(quoteRow);
      setOpportunity(oppRow);
      setEmployees(employeeRows);
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
      if (oppRow?.lead_id) {
        const lead = await getSalesLead(oppRow.lead_id).catch(() => null);
        setVendorNameOptions(buildLeadDistributorDropdownOptions(lead?.distributor_name));
      } else {
        setVendorNameOptions(buildLeadDistributorDropdownOptions(null));
      }

      const accountId = ovfRow.company_account_id ?? oppRow?.company_account_id ?? null;
      setCompany(accountId ? await getCompany(accountId).catch(() => null) : null);
      setOvfApproverName(await resolveOvfApproverName(ovfId, employeeRows));
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
        await sendOvfForApproval(ovfId, {
          team_role: payload.team_role,
          remarks: payload.remarks,
          assigned_user_id: assignedUserId ?? assignedUserIds[0],
          assigned_user_ids: assignedUserIds.length > 0 ? assignedUserIds : assignedUserId ? [assignedUserId] : undefined,
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
  const { totalMarginAmount, totalMarginPct } = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: ovf.freight,
    financeCostPct: ovf.finance_cost_pct,
  });
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
          <Trophy className="size-4" /> Deal Won at {formatInr(ovf.deal_won_amount ?? 0)} — the opportunity is now
          closed-won.
        </div>
      ) : null}

      <PageHeader
        title={ovf.ovf_no}
        description={quote ? `From Quote ${quote.quote_no}` : "Order Value Form"}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <CrmDetailEditLink href={`/crm/ovf/${ovf.id}/edit`} />
            <CrmRecordActionsMenu
              entityType="ovf"
              entityId={ovf.id}
              entityLabel="OVF"
              entityName={ovf.ovf_no}
              shareTitle={ovf.ovf_no}
              onClone={() => cloneOvfRecord()}
              onPrintPreview={onPrintPreview}
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
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        currentStageLabel={resolveSalesStageLabel({
          entityType: "ovf",
          blueprintState: blueprint.state,
          locked: blueprint.locked,
          ovf,
        })}
        defaultValues={{
          deal_won_amount: totalSaleValue > 0 ? totalSaleValue : null,
        }}
        onAction={onBlueprintAction}
        disabled={busy}
      />

      <CrmSection title="OVF Details" icon={ClipboardCheck}>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          OVF Module Information
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Customer Name">{customerName}</CrmDetailItem>
          <CrmDetailItem label="Quote Name">{quoteName}</CrmDetailItem>
          <CrmDetailItem label="Quote No.">{textOrDash(quote?.quote_no)}</CrmDetailItem>
          <CrmDetailItem label="OVF Module Owner">{ownerName}</CrmDetailItem>
          <CrmDetailItem label="PO Number">{textOrDash(ovf.po_number)}</CrmDetailItem>
          <CrmDetailItem label="Customer PO received date">
            {ovf.po_date ? String(ovf.po_date).slice(0, 10) : "—"}
          </CrmDetailItem>
          <CrmDetailItem label="Delivery Period">{textOrDash(ovf.delivery_period)}</CrmDetailItem>
          <CrmDetailItem label="OVF No.">{ovf.ovf_no}</CrmDetailItem>
          <CrmDetailItem label="OVF sent to SCM team">{ovf.shared_to_scm ? "Yes" : "No"}</CrmDetailItem>
          <CrmDetailItem label="OVF Approver">{textOrDash(ovfApproverName)}</CrmDetailItem>
          <CrmDetailItem label="Opportunity">
            {opportunity ? (
              <Link
                href={`/crm/opportunities/${opportunity.id}`}
                className="cursor-pointer font-medium text-primary underline underline-offset-2 transition-opacity duration-200 hover:opacity-80"
              >
                {opportunity.opportunity_name}
              </Link>
            ) : (
              "—"
            )}
          </CrmDetailItem>
          <CrmDetailItem label="Billing Address">
            <span className="whitespace-pre-wrap">{billingAddress}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Billing State">{billingState}</CrmDetailItem>
          <CrmDetailItem label="Billing Country">{billingCountry}</CrmDetailItem>
          <CrmDetailItem label="Billing Contact Person">{billingContact}</CrmDetailItem>
          <CrmDetailItem label="Shipping Address">
            <span className="whitespace-pre-wrap">{shippingAddress}</span>
          </CrmDetailItem>
          <CrmDetailItem label="Shipping State">{shippingState}</CrmDetailItem>
          <CrmDetailItem label="Shipping Country">{shippingCountry}</CrmDetailItem>
          <CrmDetailItem label="Shipping Contact Person">{shippingContact}</CrmDetailItem>
          <CrmDetailItem label="Installation/Service Details">
            <span className="whitespace-pre-wrap">{textOrDash(ovf.installation_details)}</span>
          </CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Technology Segment &amp; Sub Technology Segment
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Technology Segment">{textOrDash(ovf.technology_segment)}</CrmDetailItem>
          <CrmDetailItem label="Sub Technology Segment">{textOrDash(ovf.sub_technology_segment)}</CrmDetailItem>
        </CrmDetailGrid>

        <h3 className="mt-4 border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Charges and Details
        </h3>
        <CrmDetailGrid className="mt-3">
          <CrmDetailItem label="Vendor Payment Terms (days)">{ovf.vendor_payment_days}</CrmDetailItem>
          <CrmDetailItem label="Customer Payment Term (days)">{ovf.customer_payment_days}</CrmDetailItem>
          <CrmDetailItem label="Finance Cost (%)">{ovf.finance_cost_pct}%</CrmDetailItem>
          <CrmDetailItem label="Total Margin in Percentage">{totalMarginPct.toFixed(2)}%</CrmDetailItem>
          <CrmDetailItem label="Total Margin in Amount">
            {formatInrPrecise(totalMarginAmount)}
          </CrmDetailItem>
          <CrmDetailItem label="Freight Charges (₹)">{formatInr(ovf.freight)}</CrmDetailItem>
          <CrmDetailItem label="Additional Charges (₹)">{formatInr(ovf.additional_charges)}</CrmDetailItem>
          <CrmDetailItem label="Deal Won">{ovf.deal_won ? "Yes" : "No"}</CrmDetailItem>
          <CrmDetailItem label="Deal Won Amount">
            {ovf.deal_won_amount != null ? formatInr(ovf.deal_won_amount) : "—"}
          </CrmDetailItem>
          <CrmDetailItem label="Version">{ovf.version}</CrmDetailItem>
        </CrmDetailGrid>
      </CrmSection>

      <OvfOrderLinesSection
        customerRows={customerRows}
        vendorRows={vendorRows}
        vendorNameOptions={vendorNameOptions}
        disabled
      />
    </CrmPage>
  );
}
