"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Download, Eye, FileText, Handshake, Paperclip, Plus } from "lucide-react";

import {
  CrmErrorBanner,
  CrmIconBadge,
  CrmListPanel,
  CrmPage,
  CrmSection,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { CrmEntityRejectionAlert } from "@/components/crm/sales/crm-approval-inbox-listener";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { PoValidationChain } from "@/components/crm/sales/po-validation-chain";
import { SalesStageBadge } from "@/components/crm/sales/sales-stage-badge";
import { resolveSalesStageLabel } from "@/lib/crm/sales-blueprint-stages";
import { CrmDetailEditLink } from "@/components/crm/sales/crm-detail-edit-link";
import { CrmRecordActionsMenu } from "@/components/crm/sales/crm-record-actions-menu";
import { EntityAttachmentsList } from "@/components/crm/sales/entity-attachments-list";
import { CrmCustomFieldsReadOnly } from "@/components/crm/sales/crm-custom-fields-section";
import { LeadDetailsCard } from "@/components/crm/sales/lead-details-card";
import { OpportunityDealControls } from "@/components/crm/sales/opportunity-deal-controls";
import { CompanyWorkspaceNav } from "@/components/crm/company-workspace-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  buildOvfPrintPdfAttachmentById,
  buildQuotePrintPdfAttachment,
  cloneOpportunityRecord,
  downloadOpportunityExport,
  printOpportunityPreview,
} from "@/lib/crm/crm-record-actions";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { pageSectionVisible } from "@/lib/crm/crm-settings-ui";
import { setCrmOpportunityContext, setCrmSidebarFocus } from "@/lib/crm-sidebar-focus";
import { useCrmSettingsEffective } from "@/hooks/use-crm-settings";
import { ApiClientError } from "@/services/api-client";
import { listCompanyGst } from "@/services/crm-deal-controls-service";
import {
  applyOpportunityAction,
  applyQuoteAction,
  deleteOpportunity,
  formatInr,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getSalesLead,
  listAttachments,
  listCrmMemberOptions,
  listLeadSourceOptions,
  listMarketingEventOptions,
  listOvfs,
  listQuoteLines,
  listQuotes,
  downloadAttachment,
  markOvfDealWon,
  openAttachmentInNewTab,
  sendOvfForApproval,
  shareOvfToScm,
  type Attachment,
  type BlueprintState,
  type Company,
  type Opportunity,
  type Option,
  type Ovf,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

function approvalAttachmentCategory(state: string | null | undefined): string | null {
  switch (state) {
    case "sow_approval":
      return "sow";
    case "boq_approval":
      return "boq";
    case "po_approval":
      return "customer_po";
    case "cloud_discount_approval":
      return "contract";
    default:
      return null;
  }
}

const CUSTOM_ACTIONS = ["quote_accepted"];

/** Quote follow-on actions to surface on the opportunity BlueprintActions strip. */
const QUOTE_STAGE_ACTIONS: Record<string, string[]> = {
  approved_internal: ["send_to_customer"],
  sent_to_customer: ["negotiate", "accept", "lost"],
  negotiation: ["negotiate", "accept", "lost"],
  follow_up: ["negotiate", "accept", "lost"],
};

/** OVF follow-on actions to surface on the opportunity BlueprintActions strip. */
const OVF_STAGE_ACTIONS: Record<string, string[]> = {
  draft: ["send_for_approval"],
  approved: ["share_to_scm"],
  // shared_scm is CRM-terminal (no Mark Deal Won / further transitions)
};
const OVF_FOLLOW_ON = new Set(Object.values(OVF_STAGE_ACTIONS).flat());

export function OpportunityDetailPage({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromMyJobs = searchParams.get("from") === "my-jobs";
  const { settings } = useCrmSettingsEffective();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [sourceLead, setSourceLead] = useState<SalesLead | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyGstin, setCompanyGstin] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [marketingEvents, setMarketingEvents] = useState<Option[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [ovfs, setOvfs] = useState<Ovf[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppRow, bp, employeeOptions, marketingEventOptions] = await Promise.all([
        getOpportunity(opportunityId),
        getOpportunityBlueprint(opportunityId),
        listCrmMemberOptions().catch(() => [] as Option[]),
        listMarketingEventOptions().catch(() => [] as Option[]),
      ]);
      const leadSourceOptions = await listLeadSourceOptions(oppRow.company_id).catch(
        () => [] as Option[],
      );
      setOpp(oppRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      setLeadSources(leadSourceOptions);
      setMarketingEvents(marketingEventOptions);
      const [quoteRows, ovfRows, attachmentRows, leadRow, companyRow, gstRows] = await Promise.all([
        listQuotes({ opportunity_id: opportunityId }).catch(() => []),
        listOvfs({ opportunity_id: opportunityId }).catch(() => []),
        listAttachments("opportunity", opportunityId).catch(() => []),
        oppRow.lead_id ? getSalesLead(oppRow.lead_id).catch(() => null) : Promise.resolve(null),
        oppRow.company_account_id
          ? getCompany(oppRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
        oppRow.company_account_id
          ? listCompanyGst(oppRow.company_account_id).catch(() => [])
          : Promise.resolve([]),
      ]);
      setQuotes(quoteRows);
      setOvfs(ovfRows);
      setAttachments(attachmentRows);
      setSourceLead(leadRow);
      setCompany(companyRow);
      setCompanyGstin(
        (gstRows.find((row) => row.is_head_office) ?? gstRows[0])?.gstin?.trim() ?? null,
      );
    } catch (err) {
      setOpp(null);
      setCompanyGstin(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load opportunity");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setCrmSidebarFocus("opportunities");
    setCrmOpportunityContext(opportunityId);
  }, [opportunityId]);

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setBanner(null);
    try {
      if (action === "create_quote") {
        onCreateQuote();
        return;
      }
      const accepted = quotes.find((q) => q.quote_stage === "accepted");
      const quote = accepted ?? quotes[0];
      if (action === "create_ovf" || action.startsWith("create_ovf:")) {
        const parentsWithChildren = new Set(
          quotes.map((q) => q.parent_quote_id).filter((id): id is string => Boolean(id)),
        );
        const splitSource = quotes.find((q) => parentsWithChildren.has(q.id)) ?? null;
        const childSources = quotes.filter(
          (q) => q.quote_stage === "accepted" && !parentsWithChildren.has(q.id),
        );
        // Prefer the split-source (parent) so create always starts there; fall back
        // to the sole accepted quote when the deal was never split.
        const target = splitSource ?? childSources[0] ?? null;
        if (!target || ovfs.length > 0 || childSources.length === 0) {
          throw new ApiClientError(
            ovfs.length > 0
              ? "An OVF already exists for this opportunity. Open that OVF to continue."
              : "No accepted quote is available for OVF. Accept the quote (or its splits) first.",
            409,
          );
        }
        onCreateOvf(target);
        return;
      }
      const quoteFollowOn = quote ? (QUOTE_STAGE_ACTIONS[quote.quote_stage] ?? []) : [];
      const ovf = ovfs[0];
      if (ovf && OVF_FOLLOW_ON.has(action)) {
        if (action === "send_for_approval") {
          const assignedUserId =
            typeof payload.assigned_user_id === "string" ? payload.assigned_user_id : undefined;
          const assignedUserIds = Array.isArray(payload.assigned_user_ids)
            ? payload.assigned_user_ids.filter(
              (id): id is string => typeof id === "string" && Boolean(id.trim()),
            )
            : [];
          if (!assignedUserId && assignedUserIds.length === 0) {
            throw new ApiClientError("Select an approver before sending for approval.", 400);
          }
          let ovfPdf: { filename: string; base64: string } | null = null;
          try {
            ovfPdf = await buildOvfPrintPdfAttachmentById(ovf.id);
          } catch {
            ovfPdf = null;
          }
          await sendOvfForApproval(ovf.id, {
            team_role: typeof payload.team_role === "string" ? payload.team_role : undefined,
            remarks: typeof payload.remarks === "string" ? payload.remarks : null,
            assigned_user_id: assignedUserId ?? assignedUserIds[0],
            assigned_user_ids:
              assignedUserIds.length > 0
                ? assignedUserIds
                : assignedUserId
                  ? [assignedUserId]
                  : undefined,
            ovf_pdf_base64: ovfPdf?.base64 ?? null,
            ovf_pdf_filename: ovfPdf?.filename ?? null,
          });
        } else if (action === "share_to_scm") {
          await shareOvfToScm(ovf.id);
        } else if (action === "deal_won") {
          const amount = payload.deal_won_amount;
          if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
            throw new ApiClientError("Deal Won amount is required.", 400);
          }
          await markOvfDealWon(ovf.id, Number(amount));
        }
      } else if (quote && quoteFollowOn.includes(action)) {
        await applyQuoteAction(quote.id, action, payload);
      } else {
        let enrichedPayload = payload;
        if (action === "attach_po" || action === "send_po_approval") {
          const acceptedQuote = quotes.find((row) => row.quote_stage === "accepted") ?? quote;
          if (acceptedQuote) {
            try {
              const lineRows = await listQuoteLines(acceptedQuote.id);
              const quotationPdf = await buildQuotePrintPdfAttachment(acceptedQuote, lineRows);
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
        await applyOpportunityAction(opportunityId, action, enrichedPayload);
      }
      await load();
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Blueprint action failed";
      setBanner({ text: message, tone: "error" });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function onCreateQuote() {
    router.push(`/crm/quotes/new?opportunityId=${opportunityId}`);
  }

  function onCreateOvf(quote: Quote) {
    router.push(`/crm/quotes/${quote.id}/ovf/new`);
  }

  const reviewCategory = useMemo(
    () => approvalAttachmentCategory(blueprint?.state),
    [blueprint?.state],
  );
  const reviewAttachment = useMemo(() => {
    if (reviewCategory) {
      const matched = attachments.find((row) => row.category === reviewCategory);
      if (matched) return matched;
      // Legacy SOW approvals were sometimes stored under boq_approval.
      if (reviewCategory === "boq") {
        const sow = attachments.find((row) => row.category === "sow");
        if (sow) return sow;
      }
    }
    if (fromMyJobs || blueprint?.locked) return attachments[0] ?? null;
    return null;
  }, [attachments, reviewCategory, fromMyJobs, blueprint?.locked]);

  if (loading && !opp) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (error && !opp) {
    return (
      <CrmPage className="space-y-3">
        <Link href="/crm/opportunities" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Opportunities
        </Link>
        <CrmErrorBanner>{error}</CrmErrorBanner>
      </CrmPage>
    );
  }

  if (!opp || !blueprint) return null;

  const acceptedQuote = quotes.find((q) => q.quote_stage === "accepted");
  const activeQuote = acceptedQuote ?? quotes[0];
  const opportunityOvf = ovfs[0] ?? null;
  const parentsWithChildren = new Set(
    quotes.map((q) => q.parent_quote_id).filter((id): id is string => Boolean(id)),
  );
  const quotesForOvf = quotes.filter(
    (q) => q.quote_stage === "accepted" && !parentsWithChildren.has(q.id),
  );
  /** Button lives on the split source; if never split, on the sole accepted quote. */
  const ovfAnchorQuote =
    quotes.find((q) => parentsWithChildren.has(q.id)) ?? quotesForOvf[0] ?? null;
  const existingOvf = opportunityOvf;
  const canCreateQuote =
    blueprint.allowed_actions.includes("create_quote") &&
    !blueprint.locked &&
    quotes.length === 0;
  const canCreateOvf =
    blueprint.allowed_actions.includes("create_ovf") &&
    !blueprint.locked &&
    quotesForOvf.length > 0 &&
    ovfs.length === 0 &&
    blueprint.state === "ovf_ready";
  const createOvfActions = canCreateOvf ? ["create_ovf"] : [];
  const activeQuoteRevision = Math.max(1, Number(activeQuote?.quote_revision) || 1);
  const createOvfLabels: Record<string, string> = {
    ...(canCreateOvf
      ? {
        create_ovf:
          quotesForOvf.length > 1
            ? `Create OVF · ${quotesForOvf.length} quotes`
            : "Create OVF",
      }
      : {}),
    ...(activeQuote
      ? {
        negotiate: `Create Quote V${activeQuoteRevision + 1}`,
        accept: "Deal Won",
        lost: "Deal Lost",
      }
      : {}),
  };
  const showQuotes =
    pageSectionVisible(settings, "opportunity_detail", "quotes", true) &&
    (quotes.length > 0 ||
      ["quote_ready", "quote_in_progress", "po_pending", "po_approval", "ovf_ready", "won"].includes(
        blueprint.state,
      ));
  const showOvf =
    pageSectionVisible(settings, "opportunity_detail", "ovf", true) &&
    (ovfs.length > 0 || ["ovf_ready", "won"].includes(blueprint.state));
  const showBlueprint = pageSectionVisible(settings, "opportunity_detail", "blueprint", true);
  const showDocuments = pageSectionVisible(settings, "opportunity_detail", "documents", true);
  const showSummary = pageSectionVisible(settings, "opportunity_detail", "summary", true);

  const quoteFollowOnActions =
    blueprint.state === "quote_in_progress" && activeQuote
      ? (QUOTE_STAGE_ACTIONS[activeQuote.quote_stage] ?? [])
      : [];
  const ovfFollowOnActions =
    existingOvf &&
      !existingOvf.locked &&
      !existingOvf.deal_won &&
      !existingOvf.shared_to_scm
      ? (OVF_STAGE_ACTIONS[existingOvf.blueprint_state] ?? [])
      : [];
  const blueprintActions = Array.from(
    new Set([
      ...blueprint.allowed_actions.filter((action) => action !== "create_ovf"),
      ...quoteFollowOnActions,
      ...ovfFollowOnActions,
      ...(canCreateQuote ? ["create_quote"] : []),
      ...createOvfActions,
    ]),
  ).filter((action) => {
    if (action === "create_quote" && quotes.length > 0) return false;
    if (action === "create_ovf" || action.startsWith("create_ovf:")) {
      return createOvfActions.includes(action);
    }
    return true;
  });

  async function onOpenReviewAttachment() {
    if (!reviewAttachment) return;
    setAttachmentBusy(true);
    try {
      await openAttachmentInNewTab(reviewAttachment);
    } catch {
      window.alert("Could not open this attachment.");
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function onDownloadReviewAttachment() {
    if (!reviewAttachment) return;
    setAttachmentBusy(true);
    try {
      await downloadAttachment(reviewAttachment.id, reviewAttachment.file_name, reviewAttachment);
    } catch {
      window.alert("Could not download this attachment.");
    } finally {
      setAttachmentBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 items-start gap-0">
      {opp.company_account_id ? (
        <CompanyWorkspaceNav
          companyAccountId={opp.company_account_id}
          scope="opportunity"
          opportunityId={opportunityId}
          opportunity={opp}
          company={company}
        />
      ) : null}

      <div className="min-w-0 flex-1 overflow-x-clip pl-4 sm:pl-6 lg:pl-8">
        <CrmPage>
          <div>
            <Link href="/crm/opportunities" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
              <ArrowLeft className="size-3.5" /> Opportunities
            </Link>
          </div>

          <CrmEntityRejectionAlert entityType="opportunity" entityId={opportunityId} />

          <ApprovalBanner
            locked={blueprint.locked}
            approvalStatus={blueprint.state}
            label="This opportunity"
            boqAttached={opp.boq_attached}
            boqApproved={opp.boq_approved}
            sowAttached={opp.sow_attached}
            sowApproved={opp.sow_approved}
          />

          <PageHeader
            title={`${opp.opportunity_name} · ${formatCrmCode(opp.opportunity_code)}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {opp.lead_id && opp.company_account_id ? (
                  <CrmDetailEditLink
                    href={`/crm/companies/${opp.company_account_id}/edit-lead/${opp.lead_id}`}
                  />
                ) : null}
                <CrmRecordActionsMenu
                  entityType="opportunity"
                  entityId={opp.id}
                  entityLabel="Opportunity"
                  entityName={`${opp.opportunity_name} · ${formatCrmCode(opp.opportunity_code)}`}
                  shareTitle={`${opp.opportunity_name} · ${formatCrmCode(opp.opportunity_code)}`}
                  onClone={() => cloneOpportunityRecord(opp, router)}
                  onPrintPreview={async () =>
                    printOpportunityPreview({
                      opportunity: opp,
                      lead: sourceLead,
                      company,
                      leadOwnerName: sourceLead
                        ? employees.find((e) => e.id === sourceLead.owner_employee_id)?.label
                        : null,
                      presalesOwnerName: sourceLead
                        ? employees.find((e) => e.id === sourceLead.presales_owner_id)?.label
                        : null,
                      leadSourceName: sourceLead
                        ? leadSources.find((s) => s.id === sourceLead.lead_source_id)?.label
                        : null,
                    })
                  }
                  onExport={async () =>
                    downloadOpportunityExport({
                      opportunity: opp,
                      lead: sourceLead,
                      company,
                      leadOwnerName: sourceLead
                        ? employees.find((e) => e.id === sourceLead.owner_employee_id)?.label
                        : null,
                      presalesOwnerName: sourceLead
                        ? employees.find((e) => e.id === sourceLead.presales_owner_id)?.label
                        : null,
                      leadSourceName: sourceLead
                        ? leadSources.find((s) => s.id === sourceLead.lead_source_id)?.label
                        : null,
                    })
                  }
                  onDelete={() => deleteOpportunity(opp.id)}
                  onDeleted={() => router.push("/crm/opportunities")}
                />
              </div>
            }
          />

          <div className="grid gap-2 rounded-xl border border-border/80 bg-card px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Account
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {company?.customer_name?.trim() || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Stage / status
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <SalesStageBadge
                  label={resolveSalesStageLabel({
                    entityType: "opportunity",
                    blueprintState: opp.blueprint_state || opp.current_stage,
                    opportunity: opp,
                  })}
                  state={opp.blueprint_state || opp.current_stage}
                  entityType="opportunity"
                />
                <span className="text-xs capitalize text-muted-foreground">{opp.status}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {opp.status === "won" ? "Won amount" : "Expected revenue"}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {opp.status === "won" && opp.deal_won_amount != null
                  ? formatInr(opp.deal_won_amount)
                  : formatInr(opp.expected_revenue)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Code
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {formatCrmCode(opp.opportunity_code)}
              </p>
            </div>
            {opp.has_services && opp.service_sourcing_channel ? (
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Service sourcing
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {opp.service_sourcing_channel}
                </p>
              </div>
            ) : null}
          </div>

          {banner ? <CrmErrorBanner>{banner.text}</CrmErrorBanner> : null}
          {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

          {showBlueprint ? (
            <BlueprintActions
              allowedActions={blueprintActions}
              locked={blueprint.locked}
              opportunityId={opp.id}
              entityType="opportunity"
              servicesSowOwnerUserId={
                opp.has_services ||
                  (opp.product_type || "")
                    .toLowerCase()
                    .split(/[,&]/)
                    .map((p) => p.trim())
                    .includes("services")
                  ? employees.find((e) => e.id === opp.owner_employee_id)?.userId ?? null
                  : null
              }
              currentStageLabel={resolveSalesStageLabel({
                entityType: "opportunity",
                blueprintState: blueprint.state,
                locked: blueprint.locked,
                opportunity: opp,
                quotes,
                ovfs,
              })}
              showDealWonBadge={
                String(opp.status || "").toLowerCase() === "won" ||
                quotes.some((row) => row.quote_stage === "accepted")
              }
              excludeActions={CUSTOM_ACTIONS}
              actionLabelOverrides={createOvfLabels}
              defaultValues={{
                deal_won_amount: activeQuote?.grand_total ?? existingOvf?.deal_won_amount ?? null,
              }}
              onAction={onBlueprintAction}
              disabled={busy}
            />
          ) : null}

          {showBlueprint && blueprint.po_validation ? (
            <PoValidationChain validation={blueprint.po_validation} />
          ) : null}

          {showDocuments && opp.blueprint_state ? (
            <OpportunityDealControls key={opp.version} opportunity={opp} onChanged={() => void load()} />
          ) : null}

          {showQuotes ? (
            <CrmListPanel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CrmIconBadge icon={FileText} />
                  <h2 className="text-base font-extrabold tracking-tight">Quotes</h2>
                </div>
              </div>
              {quotes.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground">
                  No quotes yet - use “Create Quote” to draft one.
                </p>
              ) : (
                <div className="erp-scroll overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className={CRM_TABLE_HEAD_ROW}>
                        <th className="px-4 py-2">Quote No.</th>
                        <th className="px-4 py-2">Stage</th>
                        <th className="px-4 py-2">Grand Total</th>
                        <th className="px-4 py-2">Margin</th>
                        <th className="px-4 py-2">OVF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q) => {
                        const isSplitParent = parentsWithChildren.has(q.id);
                        const isSplitChild = Boolean(q.parent_quote_id);
                        const showOvfLink =
                          Boolean(opportunityOvf) &&
                          (isSplitParent || isSplitChild || quotesForOvf.some((row) => row.id === q.id));
                        const canRaiseOvf = canCreateOvf && ovfAnchorQuote?.id === q.id;
                        return (
                          <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                            <td className="px-4 py-2 font-medium">
                              <Link href={`/crm/quotes/${q.id}`} className="cursor-pointer hover:underline">
                                {formatCrmCode(q.quote_no)}
                              </Link>
                              {isSplitChild ? (
                                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                  Split quote
                                </span>
                              ) : isSplitParent ? (
                                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                  Split source
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2">
                              <SalesStageBadge
                                label={resolveSalesStageLabel({
                                  entityType: "quote",
                                  blueprintState: q.quote_stage,
                                  quote: q,
                                  locked: q.locked,
                                })}
                                state={q.quote_stage}
                                entityType="quote"
                              />
                            </td>
                            <td className="px-4 py-2">{formatInr(q.grand_total)}</td>
                            <td className="px-4 py-2">{q.avg_margin_pct}%</td>
                            <td className="px-4 py-2">
                              {showOvfLink && opportunityOvf ? (
                                <Link
                                  href={`/crm/ovf/${opportunityOvf.id}`}
                                  className="cursor-pointer font-medium text-primary hover:underline"
                                >
                                  {formatCrmCode(opportunityOvf.ovf_no)}
                                </Link>
                              ) : canRaiseOvf ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 cursor-pointer"
                                  disabled={busy}
                                  onClick={() => onCreateOvf(q)}
                                >
                                  <Plus className="size-3.5" />
                                  Create OVF
                                </Button>
                              ) : isSplitChild && canCreateOvf ? (
                                <span className="text-xs text-muted-foreground">
                                  Combined on opportunity OVF
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CrmListPanel>
          ) : null}

          {showOvf ? (
            <CrmListPanel>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CrmIconBadge icon={ClipboardCheck} />
                  <h2 className="text-base font-extrabold tracking-tight">OVF</h2>
                </div>
              </div>
              {ovfs.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground">
                  {quotesForOvf.length > 0
                    ? "No OVF yet — create one for this opportunity (combines all accepted split quotes)."
                    : "Create OVF once a Quote is accepted and the customer PO is approved."}
                </p>
              ) : (
                <div className="erp-scroll overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className={CRM_TABLE_HEAD_ROW}>
                        <th className="px-4 py-2">OVF No.</th>
                        <th className="px-4 py-2">Quote</th>
                        <th className="px-4 py-2">State</th>
                        <th className="px-4 py-2">Deal Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ovfs.map((o) => {
                        const linkedQuote = quotes.find((q) => q.id === o.quote_id);
                        return (
                          <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                            <td className="px-4 py-2 font-medium">
                              <Link href={`/crm/ovf/${o.id}`} className="cursor-pointer hover:underline">
                                {formatCrmCode(o.ovf_no)}
                              </Link>
                            </td>
                            <td className="px-4 py-2">
                              {linkedQuote ? (
                                <Link
                                  href={`/crm/quotes/${linkedQuote.id}`}
                                  className="cursor-pointer hover:underline"
                                >
                                  {formatCrmCode(linkedQuote.quote_no)}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <SalesStageBadge
                                label={resolveSalesStageLabel({
                                  entityType: "ovf",
                                  blueprintState: o.blueprint_state,
                                  ovf: o,
                                })}
                                state={o.blueprint_state}
                                entityType="ovf"
                              />
                            </td>
                            <td className="px-4 py-2">
                              {o.deal_won ? formatInr(o.deal_won_amount ?? 0) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CrmListPanel>
          ) : null}

          {showSummary && sourceLead ? (
            <LeadDetailsCard
              lead={sourceLead}
              company={company}
              companyGstin={companyGstin}
              employees={employees}
              leadSources={leadSources}
              marketingEvents={marketingEvents}
              title="Opportunity Information"
              mergeFullName
            />
          ) : showSummary && opp.lead_id ? (
            <CrmSection title="Source Lead" icon={Handshake}>
              <p className="text-xs text-muted-foreground">
                Source lead could not be loaded.{" "}
                <Link
                  href={`/crm/leads/${opp.lead_id}`}
                  className="cursor-pointer font-medium text-primary hover:underline"
                >
                  Open lead
                </Link>
              </p>
            </CrmSection>
          ) : null}

          {showSummary ? (
            <CrmCustomFieldsReadOnly entity="opportunity" values={opp.custom_fields} />
          ) : null}

          {(fromMyJobs || blueprint.locked) && reviewAttachment ? (
            <CrmSection
              title="Document for approval"
              icon={Paperclip}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {reviewAttachment.file_name}
                  </p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    {reviewAttachment.category.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer transition-opacity duration-200"
                    disabled={attachmentBusy}
                    onClick={() => void onOpenReviewAttachment()}
                  >
                    <Eye className="size-3.5" />
                    Open in new tab
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer transition-opacity duration-200"
                    disabled={attachmentBusy}
                    onClick={() => void onDownloadReviewAttachment()}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                </div>
              </div>
            </CrmSection>
          ) : null}

          {showDocuments ? (
            <CrmSection title="Attachments" icon={Paperclip}>
              <EntityAttachmentsList
                attachments={attachments}
                entityType="opportunity"
                entityId={opportunityId}
                branchId={opp.branch_id}
                companyId={opp.company_id}
                highlightCategory={fromMyJobs || blueprint.locked ? reviewCategory : null}
                onChanged={load}
              />
            </CrmSection>
          ) : null}
        </CrmPage>
      </div>
    </div>
  );
}
