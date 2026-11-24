"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Download,
  FileText,
  GitBranch,
  MapPin,
  Pencil,
  Scale,
  Trash2,
} from "lucide-react";

import {
  CrmErrorBanner,
  CrmInfoBanner,
  CrmPage,
  CrmSection,
} from "@/components/crm/crm-ui";
import {
  CrmReadOnlyField,
  CrmReadOnlyTextarea,
  textOrDash,
} from "@/components/crm/sales/crm-readonly-field";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CrmEntityRejectionAlert } from "@/components/crm/sales/crm-approval-inbox-listener";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { QuoteLineTable } from "@/components/crm/sales/quote-line-table";
import { QuoteSplitPanel } from "@/components/crm/sales/quote-split-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  buildQuotePrintPdfAttachment,
  downloadQuoteExport,
} from "@/lib/crm/crm-record-actions";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { ApiClientError } from "@/services/api-client";
import {
  applyOpportunityAction,
  applyQuoteAction,
  approveQuoteInternally,
  formatInrPrecise,
  fullName,
  getOpportunity,
  getOpportunityBlueprint,
  getQuote,
  getQuoteBlueprint,
  discardQuoteCurrentRevision,
  getQuoteRevisionPrintPayload,
  listContacts,
  listQuoteLines,
  listQuoteRevisions,
  listQuotes,
  listOvfs,
  sendQuoteForApproval,
  type BlueprintActionPayload,
  type BlueprintState,
  type Contact,
  type Opportunity,
  type Ovf,
  type Quote,
  type QuoteLine,
  type QuoteRevisionRow,
} from "@/services/sales-crm-service";

const QUOTE_APPROVED_STAGES = new Set([
  "approved_internal",
  "sent_to_customer",
  "negotiation",
  "follow_up",
  "accepted",
]);

/** Stages where Edit freezes the current version and opens the next draft (same as negotiate). */
const QUOTE_EDIT_OPENS_NEW_VERSION = new Set([
  "approved_internal",
  "sent_to_customer",
  "negotiation",
  "follow_up",
]);

function isQuoteApproved(quote: Quote): boolean {
  return (
    quote.approval_status === "approved" || QUOTE_APPROVED_STAGES.has(quote.quote_stage)
  );
}

function canShowQuoteEdit(quote: Quote, locked: boolean): boolean {
  if (locked) return false;
  if (quote.quote_stage === "accepted" || quote.quote_stage === "lost") return false;
  if (quote.quote_stage === "internal_approval") return false;
  return true;
}

function formatQuoteStage(stage: string): string {
  if (!stage) return "-";
  return stage.replaceAll("_", " ");
}

export function QuoteDetailPage({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [oppBlueprint, setOppBlueprint] = useState<BlueprintState | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [existingOvf, setExistingOvf] = useState<Ovf | null>(null);
  const [siblingQuotes, setSiblingQuotes] = useState<Quote[]>([]);
  const [opportunityOvfs, setOpportunityOvfs] = useState<Ovf[]>([]);
  const [revisions, setRevisions] = useState<QuoteRevisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingRevision, setDownloadingRevision] = useState<number | null>(null);
  const [removingCurrentRevision, setRemovingCurrentRevision] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [quoteRow, bp, lineRows, revisionRows] = await Promise.all([
        getQuote(quoteId),
        getQuoteBlueprint(quoteId),
        listQuoteLines(quoteId).catch(() => []),
        listQuoteRevisions(quoteId).catch(() => [] as QuoteRevisionRow[]),
      ]);
      setQuote(quoteRow);
      setBlueprint(bp);
      setLines(lineRows);
      setRevisions(revisionRows);
      const [opp, ovfRows, oppBp, siblingQuotes] = await Promise.all([
        getOpportunity(quoteRow.opportunity_id).catch(() => null),
        listOvfs({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
        getOpportunityBlueprint(quoteRow.opportunity_id).catch(() => null),
        listQuotes({ opportunity_id: quoteRow.opportunity_id }).catch(() => []),
      ]);
      setOpportunity(opp);
      setOppBlueprint(oppBp);
      setContacts(
        opp?.company_account_id
          ? await listContacts(opp.company_account_id).catch(() => [] as Contact[])
          : [],
      );
      // One OVF per opportunity (covers all accepted split quotes).
      setExistingOvf(ovfRows[0] ?? null);
      setSiblingQuotes(siblingQuotes);
      setOpportunityOvfs(ovfRows);
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
    setBanner(null);
    try {
      if (action === "create_ovf" || action.startsWith("create_ovf:")) {
        const parentsWithChildren = new Set(
          siblingQuotes.map((q) => q.parent_quote_id).filter((id): id is string => Boolean(id)),
        );
        const splitSource = siblingQuotes.find((q) => parentsWithChildren.has(q.id)) ?? null;
        const childSources = siblingQuotes.filter(
          (q) => q.quote_stage === "accepted" && !parentsWithChildren.has(q.id),
        );
        const anchor = splitSource ?? childSources[0] ?? quote;
        if (!anchor || opportunityOvfs.length > 0 || childSources.length === 0) {
          throw new ApiClientError(
            opportunityOvfs.length > 0
              ? "An OVF already exists for this opportunity. Open that OVF to continue."
              : "No accepted quote is available for OVF.",
            409,
          );
        }
        router.push(`/crm/quotes/${anchor.id}/ovf/new`);
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
        "attach_oem_quote",
        "create_ovf",
      ]);
      if (opportunity && oppActions.has(action)) {
        let enrichedPayload = payload;
        if (action === "attach_po" || action === "send_po_approval") {
          const q = quote;
          if (q) {
            try {
              const quotationPdf = await buildQuotePrintPdfAttachment(q, lines);
              enrichedPayload = {
                ...payload,
                quotation_pdf_base64: quotationPdf.base64,
                quotation_pdf_filename: quotationPdf.filename,
              };
            } catch {
              // PO approval still proceeds; email may omit the quote print.
            }
          }
        }
        await applyOpportunityAction(opportunity.id, action, enrichedPayload);
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
        const q = quote;
        let quotationPdf: { filename: string; base64: string } | null = null;
        if (q) {
          try {
            quotationPdf = await buildQuotePrintPdfAttachment(q, lines);
          } catch {
            quotationPdf = null;
          }
        }
        await sendQuoteForApproval(quoteId, {
          team_role: typeof payload.team_role === "string" ? payload.team_role : undefined,
          assigned_user_id: assignedUserId,
          assigned_user_ids: assignedUserIds.length > 0 ? assignedUserIds : [assignedUserId],
          remarks: typeof payload.remarks === "string" ? payload.remarks : null,
          quotation_pdf_base64: quotationPdf?.base64 ?? null,
          quotation_pdf_filename: quotationPdf?.filename ?? null,
        });
      } else if (action === "approve_internally") {
        await approveQuoteInternally(quoteId, { remark: payload.remark });
      } else if (action === "negotiate") {
        await applyQuoteAction(quoteId, action, payload);
        router.push(`/crm/quotes/${quoteId}/edit`);
        return;
      } else {
        await applyQuoteAction(quoteId, action, payload);
      }

      if (action === "send_to_customer") {
        setBanner({
          text: "Quote marked as sent to customer.",
          tone: "success",
        });
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

  const readOnlyLines =
    quote.locked ||
    ["accepted", "lost", "sent_to_customer", "follow_up"].includes(quote.quote_stage);
  const contact =
    contacts.find((row) => row.id === quote.contact_id) ??
    contacts.find((row) => row.is_primary) ??
    null;
  const contactName = contact ? fullName(contact) : "-";

  const parentsWithChildren = new Set(
    siblingQuotes.map((q) => q.parent_quote_id).filter((id): id is string => Boolean(id)),
  );
  const quotesForOvf = siblingQuotes.filter(
    (q) => q.quote_stage === "accepted" && !parentsWithChildren.has(q.id),
  );
  const opportunityReadyForOvf =
    Boolean(oppBlueprint?.allowed_actions.includes("create_ovf")) ||
    ((oppBlueprint?.state === "ovf_ready" || opportunity?.blueprint_state === "ovf_ready") &&
      Boolean(opportunity?.customer_po_approved));
  const canCreateOvf =
    opportunityReadyForOvf &&
    quotesForOvf.length > 0 &&
    opportunityOvfs.length === 0 &&
    !blueprint.locked;
  const createOvfActions = canCreateOvf ? ["create_ovf"] : [];
  const revisionNo = Math.max(1, Number(quote.quote_revision) || 1);
  const createOvfLabels: Record<string, string> = {
    ...(canCreateOvf
      ? {
        create_ovf:
          quotesForOvf.length > 1
            ? `Create OVF · ${quotesForOvf.length} quotes`
            : "Create OVF",
      }
      : {}),
    ...(revisionNo > 1
      ? { send_for_approval: `Send V${revisionNo} for Approval` }
      : {}),
    negotiate: `Create Quote V${revisionNo + 1}`,
    accept: "Deal Won",
    lost: "Deal Lost",
  };

  const oppTransitionActions =
    quote.quote_stage === "accepted" && oppBlueprint
      ? oppBlueprint.allowed_actions.filter(
        (action) =>
          action !== "create_quote" &&
          action !== "create_ovf" &&
          action !== "quote_accepted" &&
          action !== "send_po_approval" &&
          action !== "lost" &&
          !blueprint.allowed_actions.includes(action),
      )
      : [];

  // V1 already sent/approved must not re-offer Send for Approval. After
  // negotiate, quote_revision >= 2 and draft correctly shows the action again.
  // Frozen snapshots set snapshotted_at; the live draft stub must leave it null
  // so brand-new V1 drafts still show Send for Approval.
  const v1AlreadyApproved =
    revisionNo <= 1 &&
    (quote.approval_status === "approved" ||
      quote.approval_status === "pending" ||
      ["internal_approval", "approved_internal", "sent_to_customer", "negotiation", "follow_up", "accepted"].includes(
        quote.quote_stage,
      ) ||
      revisions.some((row) => row.revision_no === 1 && Boolean(row.snapshotted_at)));
  const dealAlreadyWon =
    quote.quote_stage === "accepted" ||
    String(opportunity?.status || "").toLowerCase() === "won";
  const blueprintActions = Array.from(
    new Set([
      ...blueprint.allowed_actions,
      ...oppTransitionActions,
      ...createOvfActions,
    ]),
  ).filter(
    (action) =>
      !(action === "send_for_approval" && v1AlreadyApproved) &&
      !(action === "lost" && dealAlreadyWon),
  );

  function canDownloadRevision(row: QuoteRevisionRow): boolean {
    // Current version: only after internal approval (or later customer stages).
    if (row.is_current) return isQuoteApproved(quote);
    // Prior versions exist only after negotiate from an approved/sent quote.
    return Boolean(row.snapshotted_at);
  }

  function canRemoveCurrentRevision(row: QuoteRevisionRow): boolean {
    if (!row.is_current) return false;
    if (row.revision_no <= 1) return false;
    if (quote.quote_stage === "accepted" || quote.quote_stage === "lost") return false;
    // Only until this version is approved — then next steps (Vn+1 / won / lost) apply on it.
    return !isQuoteApproved(quote);
  }

  async function onRemoveCurrentRevision() {
    if (!quote) return;
    const currentRev = Math.max(1, Number(quote.quote_revision) || 1);
    if (
      !window.confirm(
        `Remove V${currentRev} and restore approved V${currentRev - 1}? Create Quote V${currentRev}, Deal Won, and Deal Lost will return.`,
      )
    ) {
      return;
    }
    setRemovingCurrentRevision(true);
    setBusy(true);
    setBanner(null);
    try {
      await discardQuoteCurrentRevision(quoteId);
      setBanner({
        text: `V${currentRev} removed. Restored approved V${currentRev - 1}.`,
        tone: "success",
      });
      await load();
    } catch (err) {
      setBanner({
        text: err instanceof ApiClientError ? err.message : "Failed to remove current quote version",
        tone: "error",
      });
    } finally {
      setRemovingCurrentRevision(false);
      setBusy(false);
    }
  }

  async function onEditQuote() {
    if (!quote) return;
    setBusy(true);
    setBanner(null);
    try {
      if (QUOTE_EDIT_OPENS_NEW_VERSION.has(quote.quote_stage)) {
        await applyQuoteAction(quoteId, "negotiate", {
          remark: "Edit opened a new quote version for re-approval",
        });
      }
      router.push(`/crm/quotes/${quoteId}/edit`);
    } catch (err) {
      setBanner({
        text: err instanceof ApiClientError ? err.message : "Failed to open quote for edit",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadRevision(revisionNo: number) {
    setDownloadingRevision(revisionNo);
    setBanner(null);
    try {
      if (revisionNo === Math.max(1, Number(quote?.quote_revision) || 1) && quote) {
        await downloadQuoteExport(quote, lines);
        return;
      }
      const payload = await getQuoteRevisionPrintPayload(quoteId, revisionNo);
      const archivedQuote = {
        ...payload.quote,
        quote_revision: payload.revision_no,
        freight: Number(payload.quote.freight || 0),
        grand_total: Number(payload.quote.grand_total || 0),
        avg_margin_pct: Number(payload.quote.avg_margin_pct || 0),
        total_margin_amount: Number(payload.quote.total_margin_amount || 0),
        locked: Boolean(payload.quote.locked),
        version: Number(payload.quote.version || 1),
      } as Quote;
      const archivedLines = payload.lines.map((line, index) => ({
        ...line,
        line_no: Number(line.line_no || index + 1),
        qty: Number(line.qty || 0),
        unit_cost: Number(line.unit_cost || 0),
        unit_sell: Number(line.unit_sell || 0),
        margin_pct: Number(line.margin_pct || 0),
        margin_amount: Number(line.margin_amount || 0),
        gst_pct: Number(line.gst_pct || 0),
        gst_amount: Number(line.gst_amount || 0),
        line_total: Number(line.line_total || 0),
        version: Number(line.version || 1),
      })) as QuoteLine[];
      await downloadQuoteExport(archivedQuote, archivedLines);
    } catch (err) {
      setBanner({
        text: err instanceof ApiClientError ? err.message : `Failed to download V${revisionNo} PDF`,
        tone: "error",
      });
    } finally {
      setDownloadingRevision(null);
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
        title={`${formatCrmCode(quote.quote_no)}${quote.quote_revision > 1 ? ` V${quote.quote_revision}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canShowQuoteEdit(quote, blueprint.locked) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 cursor-pointer gap-1.5 px-2.5 text-[0.8rem] transition-colors duration-200"
                disabled={busy}
                onClick={() => void onEditQuote()}
              >
                <Pencil className="size-3.5" />
                {busy && QUOTE_EDIT_OPENS_NEW_VERSION.has(quote.quote_stage)
                  ? "Opening…"
                  : "Edit"}
              </Button>
            ) : null}
            {existingOvf ? (
              <Link
                href={`/crm/ovf/${existingOvf.id}`}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60"
              >
                Open OVF
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
        banner.tone === "success" ? (
          <CrmInfoBanner>{banner.text}</CrmInfoBanner>
        ) : (
          <CrmErrorBanner>{banner.text}</CrmErrorBanner>
        )
      ) : null}
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <BlueprintActions
        allowedActions={blueprintActions}
        locked={blueprint.locked && oppTransitionActions.length === 0 && createOvfActions.length === 0}
        entityType="quote"
        currentStageLabel={resolveSalesStageLabel({
          entityType: "quote",
          blueprintState: blueprint.state,
          locked: blueprint.locked,
          quote,
        })}
        showDealWonBadge={dealAlreadyWon}
        excludeActions={["approve_internally"]}
        actionLabelOverrides={createOvfLabels}
        onAction={onBlueprintAction}
        disabled={busy}
      />
      <CrmSection title="Quote Versions" icon={GitBranch}>
        <div className="erp-scroll min-w-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-3 py-2">Quote Version</th>
                <th className="px-3 py-2 text-right">Avg Margin %</th>
                <th className="px-3 py-2 text-right">Grand Total</th>
                <th className="px-3 py-2 text-right">Negotiation %</th>
                <th className="px-3 py-2 text-right">Print PDF</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No quote versions yet.
                  </td>
                </tr>
              ) : (
                revisions.map((row) => (
                  <tr
                    key={row.revision_no}
                    className={`border-b border-border/50 last:border-0 ${row.is_current ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-2">
                        V{row.revision_no}
                        {row.is_current ? (
                          <span className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                            Current
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(row.avg_margin_pct || 0).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatInrPrecise(row.grand_total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.revision_no <= 1
                        ? "—"
                        : `${Number(row.negotiation_pct || 0) > 0 ? "+" : ""}${Number(row.negotiation_pct || 0).toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {canDownloadRevision(row) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 cursor-pointer gap-1.5 px-2.5 text-[0.8rem] transition-colors duration-200"
                            disabled={downloadingRevision === row.revision_no || busy}
                            onClick={() => void onDownloadRevision(row.revision_no)}
                            aria-label={`Download V${row.revision_no} print PDF`}
                          >
                            <Download className="size-3.5" />
                            {downloadingRevision === row.revision_no ? "…" : "Download"}
                          </Button>
                        ) : null}
                        {canRemoveCurrentRevision(row) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 cursor-pointer gap-1.5 px-2.5 text-[0.8rem] text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                            disabled={removingCurrentRevision || busy}
                            onClick={() => void onRemoveCurrentRevision()}
                            aria-label={`Remove current quote V${row.revision_no} and restore previous approved version`}
                          >
                            <Trash2 className="size-3.5" />
                            {removingCurrentRevision ? "…" : "Remove"}
                          </Button>
                        ) : null}
                        {!canDownloadRevision(row) && !canRemoveCurrentRevision(row) ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Negotiation % compares each version grand total against original V1. Moving to negotiation
          creates the next version and restarts approval. Print PDF download is available after that
          version is approved. Remove on the current unapproved version restores the prior approved
          quote so Create Quote Vn+1, Deal Won, and Deal Lost return.
        </p>
      </CrmSection>

      <CrmSection title="Quote Information" icon={FileText}>
        <div className="grid min-w-0 gap-x-6 gap-y-3 md:grid-cols-2">
          <CrmReadOnlyField
            label="Project Title"
            value={textOrDash(quote.project_title)}
          />
          <CrmReadOnlyField label="Account Name" value={textOrDash(quote.account_name)} />
          <CrmReadOnlyField label="Price Validity Date *" value={textOrDash(quote.valid_until)} />
          <CrmReadOnlyField label="Contact Name" value={contactName} />
          <CrmReadOnlyField label="Quote Owner" value={textOrDash(quote.owner_name)} />
          <CrmReadOnlyField label="Quote No." value={formatCrmCode(quote.quote_no)} />
          <CrmReadOnlyField
            label="Quote Stage"
            value={formatQuoteStage(quote.quote_stage)}
          />
          <CrmReadOnlyField label="Quote Version" value={`V${quote.quote_revision ?? 1}`} />
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

      <QuoteSplitPanel quote={quote} contacts={contacts} />
    </CrmPage>
  );
}
