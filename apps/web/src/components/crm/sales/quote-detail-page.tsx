"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  FileText,
  MapPin,
  Scale,
} from "lucide-react";

import {
  CrmErrorBanner,
  CrmPage,
  CrmSection,
  CrmWarnBanner,
} from "@/components/crm/crm-ui";
import {
  CrmReadOnlyField,
  CrmReadOnlyTextarea,
  textOrDash,
} from "@/components/crm/sales/crm-readonly-field";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CrmEntityRejectionAlert } from "@/components/crm/sales/crm-approval-inbox-listener";
import { AttachmentsPanel } from "@/components/crm/sales/attachments-panel";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { CrmDetailEditLink } from "@/components/crm/sales/crm-detail-edit-link";
import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import { normalizeQuoteServiceType } from "@/lib/crm/lead-product-options";
import { QuoteLineTable } from "@/components/crm/sales/quote-line-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cloneQuoteRecord, printQuotePreview } from "@/lib/crm/crm-record-actions";
import { ApiClientError } from "@/services/api-client";
import {
  applyOpportunityAction,
  applyQuoteAction,
  approveQuoteInternally,
  deleteQuote,
  formatInr,
  fullName,
  getOpportunity,
  getOpportunityBlueprint,
  getQuote,
  getQuoteBlueprint,
  getQuoteMargin,
  listAttachments,
  listContacts,
  listQuoteLines,
  listOvfs,
  sendQuoteForApproval,
  type BlueprintActionPayload,
  type BlueprintState,
  type Contact,
  type Opportunity,
  type Ovf,
  type Quote,
  type QuoteLine,
  type QuoteMarginSummary,
  type Attachment,
} from "@/services/sales-crm-service";

function formatQuoteStage(stage: string): string {
  if (!stage) return "—";
  return stage.replaceAll("_", " ");
}

export function QuoteDetailPage({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [margin, setMargin] = useState<QuoteMarginSummary | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [oppBlueprint, setOppBlueprint] = useState<BlueprintState | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [existingOvf, setExistingOvf] = useState<Ovf | null>(null);
  const [hasVendorQuote, setHasVendorQuote] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);
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
      setAttachments(attachmentRows);
      setHasVendorQuote(attachmentRows.some((row) => row.category === "vendor_quote"));
      const [opp, ovfRows, oppBp] = await Promise.all([
        getOpportunity(quoteRow.opportunity_id).catch(() => null),
        listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
        getOpportunityBlueprint(quoteRow.opportunity_id).catch(() => null),
      ]);
      setOpportunity(opp);
      setOppBlueprint(oppBp);
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
      if (action === "create_ovf") {
        router.push(`/crm/quotes/${quoteId}/ovf/new`);
        return;
      }
      const oppActions = new Set([
        "attach_po",
        "send_po_approval",
        "lost",
        "attach_boq",
        "attach_sow",
        "send_boq_approval",
        "send_sow_approval",
        "skip_sow",
        "deal_reg",
        "oem_received",
        "attach_oem_quote",
        "create_ovf",
      ]);
      if (opportunity && oppActions.has(action)) {
        await applyOpportunityAction(opportunity.id, action, payload);
        await load();
        return;
      }
      if (action === "send_for_approval") {
        const assignedUserId = payload.assigned_user_id;
        const assignedUserIds = Array.isArray(payload.assigned_user_ids)
          ? payload.assigned_user_ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
          : [];
        if (typeof assignedUserId !== "string" || !assignedUserId.trim()) {
          throw new ApiClientError("Select an approver before sending for approval.", 400);
        }
        await sendQuoteForApproval(quoteId, {
          team_role: typeof payload.team_role === "string" ? payload.team_role : undefined,
          assigned_user_id: assignedUserId,
          assigned_user_ids: assignedUserIds.length > 0 ? assignedUserIds : [assignedUserId],
          remarks: typeof payload.remarks === "string" ? payload.remarks : null,
        });
      } else if (action === "approve_internally") {
        await approveQuoteInternally(quoteId, { remark: payload.remark });
      } else {
        await applyQuoteAction(quoteId, action, payload);
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
      <CrmPage className="space-y-3">
        <Link href="/crm/quotes" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Quotes
        </Link>
        <CrmErrorBanner>{error}</CrmErrorBanner>
      </CrmPage>
    );
  }

  if (!quote || !blueprint) return null;

  const readOnlyLines = quote.locked || ["accepted", "lost", "sent_to_customer", "negotiation", "follow_up"].includes(quote.quote_stage);
  const nearingSubmit = blueprint.allowed_actions.includes("send_for_approval") && !hasVendorQuote;
  const contact =
    contacts.find((row) => row.id === quote.contact_id) ??
    contacts.find((row) => row.is_primary) ??
    null;
  const contactName = contact ? fullName(contact) : "—";
  const boqAttachmentLabel =
    attachments
      .filter((row) => row.category === "boq")
      .map((row) => row.file_name)
      .join(", ") || "—";

  const canCreateOvf =
    quote.quote_stage === "accepted" &&
    !existingOvf &&
    opportunity?.blueprint_state === "ovf_ready" &&
    Boolean(opportunity.customer_po_approved);

  const oppTransitionActions =
    quote.quote_stage === "accepted" && oppBlueprint
      ? oppBlueprint.allowed_actions.filter(
          (action) =>
            action !== "create_quote" &&
            action !== "quote_accepted" &&
            !blueprint.allowed_actions.includes(action),
        )
      : [];

  const blueprintActions = Array.from(
    new Set([
      ...blueprint.allowed_actions,
      ...oppTransitionActions,
      ...(canCreateOvf ? ["create_ovf"] : []),
    ]),
  );

  async function onPrintPreview() {
    const q = quote;
    if (!q) return;
    await printQuotePreview(q, lines);
  }

  return (
    <CrmPage>
      <div>
        <Link href="/crm/quotes" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
          <ArrowLeft className="size-3.5" /> Quotes
        </Link>
      </div>

      <CrmEntityRejectionAlert entityType="quote" entityId={quote.id} />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={blueprint.state} label="This quote" />

      <PageHeader
        title={`${quote.quote_no}${quote.quote_revision > 1 ? ` (Rev ${quote.quote_revision})` : ""}`}
        description={quote.subject ?? "Customer quotation"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CrmDetailEditLink href={`/crm/quotes/${quote.id}/edit`} />
            {existingOvf ? (
              <Link
                href={`/crm/ovf/${existingOvf.id}`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
              >
                Open OVF
              </Link>
            ) : null}
            {quote ? (
              <CrmRecordActionsMenu
                entityType="quote"
                entityId={quote.id}
                entityLabel="Quote"
                entityName={quote.quote_no}
                shareTitle={quote.quote_no}
                onClone={() => cloneQuoteRecord(quote, lines, router)}
                onPrintPreview={onPrintPreview}
                onDelete={() => deleteQuote(quote.id)}
                onDeleted={() =>
                  router.push(
                    opportunity ? `/crm/opportunities/${opportunity.id}` : "/crm/quotes",
                  )
                }
              />
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

      {banner ? <CrmErrorBanner>{banner.text}</CrmErrorBanner> : null}
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      {nearingSubmit ? (
        <CrmWarnBanner>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            No vendor quote attached yet — attach it below before sending this quote for approval.
          </span>
        </CrmWarnBanner>
      ) : null}

      <BlueprintActions
        allowedActions={blueprintActions}
        locked={blueprint.locked && oppTransitionActions.length === 0}
        currentStageLabel={resolveSalesStageLabel({
          entityType: "quote",
          blueprintState: blueprint.state,
          locked: blueprint.locked,
          quote,
        })}
        excludeActions={["approve_internally"]}
        onAction={onBlueprintAction}
        disabled={busy}
      />
      {margin?.requires_management_approval && !blueprint.locked ? (
        <CrmWarnBanner>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Margin is below the management threshold ({margin.required_threshold_pct}%). Use Send for
            Approval.
          </span>
        </CrmWarnBanner>
      ) : null}

      <CrmSection title="Quote Information" icon={FileText}>
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <CrmReadOnlyField
            label="Project Title"
            value={textOrDash(quote.project_title)}
          />
          <CrmReadOnlyField label="Subject *" value={textOrDash(quote.subject)} />
          <CrmReadOnlyField label="Account Name" value={textOrDash(quote.account_name)} />
          <CrmReadOnlyField label="Valid Until *" value={textOrDash(quote.valid_until)} />
          <CrmReadOnlyField label="Contact Name" value={contactName} />
          <CrmReadOnlyField label="Quote Owner" value={textOrDash(quote.owner_name)} />
          <CrmReadOnlyField
            label="Service Type *"
            value={textOrDash(normalizeQuoteServiceType(quote.service_type) || quote.service_type)}
          />
          <CrmReadOnlyField label="Quote No." value={quote.quote_no} />
          <CrmReadOnlyField
            label="Quote Stage"
            value={formatQuoteStage(quote.quote_stage)}
          />
          <CrmReadOnlyField label="Version" value={String(quote.version ?? 1)} />
        </div>
      </CrmSection>

      <CrmSection title="Entity Information" icon={Building2}>
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <CrmReadOnlyField label="Entity Name" value={textOrDash(quote.entity_name)} />
          <CrmReadOnlyField label="Entity Address" value={textOrDash(quote.entity_address)} />
          <CrmReadOnlyField
            label="Entity Contact Number"
            value={textOrDash(quote.entity_contact)}
          />
          <CrmReadOnlyField label="Entity Email" value={textOrDash(quote.entity_email)} />
          <CrmReadOnlyField label="Entity GST No." value={textOrDash(quote.entity_gst)} />
        </div>
      </CrmSection>

      <CrmSection title="Terms and Conditions" icon={Scale}>
        <div className="grid min-w-0 grid-cols-1 gap-y-3">
          <CrmReadOnlyTextarea label="Terms and Conditions" value={textOrDash(quote.terms)} />
          <CrmReadOnlyField label="Freight Charges (₹)" value={formatInr(quote.freight)} />
          <CrmReadOnlyField label="BOQ Attachment (multiple)" value={boqAttachmentLabel} />
          <CrmReadOnlyField
            label="AMC/Warranty"
            value={
              quote.amc_warranty === "yes"
                ? "Yes"
                : quote.amc_warranty === "no"
                  ? "No"
                  : "None"
            }
          />
          <CrmReadOnlyField label="Start Date" value={textOrDash(quote.amc_start_date)} />
          <CrmReadOnlyField label="End Date" value={textOrDash(quote.amc_end_date)} />
        </div>
      </CrmSection>

      <CrmSection title="Customer Address Information" icon={MapPin}>
        <div className="grid min-w-0 gap-x-10 gap-y-5 lg:grid-cols-2">
          <div className="grid min-w-0 grid-cols-1 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing Address</p>
            <CrmReadOnlyField label="Street" value={textOrDash(quote.billing_street)} />
            <CrmReadOnlyField label="City" value={textOrDash(quote.billing_city)} />
            <CrmReadOnlyField label="State" value={textOrDash(quote.billing_state)} />
            <CrmReadOnlyField label="Zip Code" value={textOrDash(quote.billing_zip)} />
            <CrmReadOnlyField label="Country" value={textOrDash(quote.billing_country)} />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping Address</p>
            <CrmReadOnlyField label="Street" value={textOrDash(quote.shipping_street)} />
            <CrmReadOnlyField label="City" value={textOrDash(quote.shipping_city)} />
            <CrmReadOnlyField label="State" value={textOrDash(quote.shipping_state)} />
            <CrmReadOnlyField label="Zip Code" value={textOrDash(quote.shipping_zip)} />
            <CrmReadOnlyField label="Country" value={textOrDash(quote.shipping_country)} />
          </div>
        </div>
      </CrmSection>

      <QuoteLineTable
        quoteId={quote.id}
        lines={lines}
        readOnly={readOnlyLines}
        initialDraft={{
          product_name: "",
          line_type: "hardware",
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
    </CrmPage>
  );
}
