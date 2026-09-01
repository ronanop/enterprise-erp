"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  FileText,
  Plus,
  Scale,
} from "lucide-react";

import { exportQuotePdf, loadSellerLetterhead } from "@/lib/crm/export-quote-pdf";

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
import { CrmAdminDeleteMenu } from "@/components/crm/sales/crm-admin-delete-menu";
import { CrmDetailEditLink } from "@/components/crm/sales/crm-detail-edit-link";
import { DealTimelineStatusBadge, type DealStage } from "@/components/crm/sales/deal-timeline";
import { QuoteLineTable } from "@/components/crm/sales/quote-line-table";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  applyQuoteAction,
  approveQuoteInternally,
  deleteQuote,
  formatInr,
  fullName,
  getOpportunity,
  getQuote,
  getQuoteBlueprint,
  getQuoteMargin,
  getSalesLead,
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
  type SalesLead,
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
  const [sourceLead, setSourceLead] = useState<SalesLead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [existingOvf, setExistingOvf] = useState<Ovf | null>(null);
  const [hasVendorQuote, setHasVendorQuote] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      const [opp, ovfRows] = await Promise.all([
        getOpportunity(quoteRow.opportunity_id).catch(() => null),
        listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
      ]);
      setOpportunity(opp);
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
      <CrmPage className="space-y-3">
        <Link href="/crm/quotes" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Quotes
        </Link>
        <CrmErrorBanner>{error}</CrmErrorBanner>
      </CrmPage>
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

  async function onExportPdf() {
    const q = quote;
    if (!q) return;
    setExporting(true);
    setError(null);
    try {
      const seller = await loadSellerLetterhead(q.company_id, q.branch_id);
      await exportQuotePdf({
        quote: q,
        lines,
        seller,
        customerName: textOrDash(quote.entity_name || quote.account_name),
        customerAddress: textOrDash(quote.entity_address),
        subject: q.subject || q.project_title || q.quote_no,
        ownerName: textOrDash(quote.owner_name),
        termsOverride: q.terms,
      });
      setBanner({ text: "Quote PDF exported.", tone: "success" });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to export quote PDF";
      setBanner({ text: message, tone: "error" });
    } finally {
      setExporting(false);
    }
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
            <FinanceStatusBadge status={quote.approval_status} />
            <DealTimelineStatusBadge stage={timelineStage} lost={lost} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 cursor-pointer px-2.5 text-[0.8rem] transition-colors duration-200"
              disabled={exporting || loading}
              onClick={() => void onExportPdf()}
            >
              <Download className={`size-3.5 ${exporting ? "animate-pulse" : ""}`} />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
            {!quote.locked &&
              quote.quote_stage !== "accepted" &&
              quote.quote_stage !== "lost" ? (
              <CrmDetailEditLink href={`/crm/quotes/${quote.id}/edit`} />
            ) : null}
            {canCreateOvf ? (
              <Link
                href={`/crm/quotes/${quote.id}/ovf/new`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                <Plus className="size-3.5" /> Create OVF
              </Link>
            ) : existingOvf ? (
              <Link
                href={`/crm/ovf/${existingOvf.id}`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
              >
                Open OVF
              </Link>
            ) : null}
            {quote ? (
              <CrmAdminDeleteMenu
                entityLabel="Quote"
                entityName={quote.quote_no}
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

      {nearingSubmit ? (
        <CrmWarnBanner>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            No vendor quote attached yet — attach it below before sending this quote for approval.
          </span>
        </CrmWarnBanner>
      ) : null}

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
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
          <CrmReadOnlyField label="Service Type *" value={textOrDash(quote.service_type)} />
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
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <CrmReadOnlyTextarea label="Terms and Conditions" value={textOrDash(quote.terms)} />
          </div>
          <CrmReadOnlyField label="Freight Charges (₹)" value={formatInr(quote.freight)} />
          <CrmReadOnlyField label="BOQ Attachment (multiple)" value={boqAttachmentLabel} />
          <CrmReadOnlyField label="Billing Country" value={textOrDash(quote.billing_country)} />
          <CrmReadOnlyField label="Shipping Country" value={textOrDash(quote.shipping_country)} />
        </div>
      </CrmSection>

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
    </CrmPage>
  );
}
