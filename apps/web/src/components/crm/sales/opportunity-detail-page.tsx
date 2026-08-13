"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileText, Handshake, Paperclip, Plus } from "lucide-react";

import {
  CrmErrorBanner,
  CrmIconBadge,
  CrmListPanel,
  CrmPage,
  CrmSection,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline, DealTimelineStatusBadge, type DealStage } from "@/components/crm/sales/deal-timeline";
import { EntityAttachmentsList } from "@/components/crm/sales/entity-attachments-list";
import { LeadDetailsCard } from "@/components/crm/sales/lead-details-card";
import { CompanyWorkspaceNav } from "@/components/crm/company-workspace-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setCrmOpportunityContext, setCrmSidebarFocus } from "@/lib/crm-sidebar-focus";
import { ApiClientError } from "@/services/api-client";
import {
  applyOpportunityAction,
  applyQuoteAction,
  formatInr,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getOpportunityTimeline,
  getSalesLead,
  listAttachments,
  listCrmMemberOptions,
  listLeadSourceOptions,
  listOvfs,
  listQuotes,
  markOvfDealWon,
  sendOvfForApproval,
  shareOvfToScm,
  type Attachment,
  type BlueprintState,
  type Company,
  type Opportunity,
  type OpportunityTimelineEvent,
  type Option,
  type Ovf,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

const CUSTOM_ACTIONS = ["create_quote", "quote_accepted", "create_ovf"];

/** Quote follow-on actions to surface on the opportunity BlueprintActions strip. */
const QUOTE_STAGE_ACTIONS: Record<string, string[]> = {
  approved_internal: ["send_to_customer"],
  sent_to_customer: ["accept", "negotiate", "follow_up"],
  negotiation: ["accept", "negotiate", "follow_up"],
  follow_up: ["accept", "negotiate", "follow_up"],
};

/** OVF follow-on actions to surface on the opportunity BlueprintActions strip. */
const OVF_STAGE_ACTIONS: Record<string, string[]> = {
  draft: ["send_for_approval"],
  approved: ["share_to_scm"],
  shared_scm: ["deal_won"],
};
const OVF_FOLLOW_ON = new Set(Object.values(OVF_STAGE_ACTIONS).flat());

export function OpportunityDetailPage({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [sourceLead, setSourceLead] = useState<SalesLead | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [leadSources, setLeadSources] = useState<Option[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [ovfs, setOvfs] = useState<Ovf[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<OpportunityTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppRow, bp, employeeOptions, leadSourceOptions] = await Promise.all([
        getOpportunity(opportunityId),
        getOpportunityBlueprint(opportunityId),
        listCrmMemberOptions().catch(() => [] as Option[]),
        listLeadSourceOptions().catch(() => [] as Option[]),
      ]);
      setOpp(oppRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      setLeadSources(leadSourceOptions);
      const [quoteRows, ovfRows, attachmentRows, leadRow, companyRow, timeline] = await Promise.all([
        listQuotes({ opportunity_id: opportunityId }).catch(() => []),
        listOvfs({ opportunity_id: opportunityId }).catch(() => []),
        listAttachments("opportunity", opportunityId).catch(() => []),
        oppRow.lead_id ? getSalesLead(oppRow.lead_id).catch(() => null) : Promise.resolve(null),
        oppRow.company_account_id
          ? getCompany(oppRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
        getOpportunityTimeline(opportunityId).catch(() => null),
      ]);
      setQuotes(quoteRows);
      setOvfs(ovfRows);
      setAttachments(attachmentRows);
      setSourceLead(leadRow);
      setCompany(companyRow);
      setTimelineEvents(timeline?.events ?? []);
    } catch (err) {
      setOpp(null);
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
      const accepted = quotes.find((q) => q.quote_stage === "accepted");
      const quote = accepted ?? quotes[0];
      const quoteFollowOn = quote ? (QUOTE_STAGE_ACTIONS[quote.quote_stage] ?? []) : [];
      const ovf = ovfs[0];
      if (ovf && OVF_FOLLOW_ON.has(action)) {
        if (action === "send_for_approval") {
          await sendOvfForApproval(ovf.id, {
            team_role: typeof payload.team_role === "string" ? payload.team_role : undefined,
            remarks: typeof payload.remarks === "string" ? payload.remarks : null,
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
        await applyOpportunityAction(opportunityId, action, payload);
      }
      setBanner({ text: `Action "${action.replaceAll("_", " ")}" applied.`, tone: "success" });
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
    router.push(`/crm/opportunities/${opportunityId}/quotes/new`);
  }

  function onCreateOvf(quote: Quote) {
    router.push(`/crm/quotes/${quote.id}/ovf/new`);
  }

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

  const lost = blueprint.state === "lost" || opp.status === "lost";
  const won = blueprint.state === "won" || opp.status === "won";
  const acceptedQuote = quotes.find((q) => q.quote_stage === "accepted");
  const activeQuote = acceptedQuote ?? quotes[0];
  const existingOvf = ovfs[0];
  const canCreateQuote = blueprint.allowed_actions.includes("create_quote") && !blueprint.locked;
  const canCreateOvf =
    blueprint.allowed_actions.includes("create_ovf") &&
    !blueprint.locked &&
    !existingOvf &&
    !!acceptedQuote &&
    blueprint.state === "ovf_ready";
  const showQuotes =
    quotes.length > 0 ||
    ["quote_ready", "quote_in_progress", "po_pending", "po_approval", "ovf_ready", "won"].includes(
      blueprint.state,
    );
  const showOvf = ovfs.length > 0 || ["ovf_ready", "won"].includes(blueprint.state);

  const timelineStage: DealStage = won
    ? "won"
    : existingOvf || blueprint.state === "ovf_ready"
      ? "ovf"
      : ["quote_ready", "quote_in_progress", "po_pending", "po_approval"].includes(blueprint.state) ||
        !!activeQuote
        ? "quote"
        : "opportunity";
  const timelineLinks = {
    ...(opp.company_account_id ? { company: `/crm/companies/${opp.company_account_id}` } : {}),
    ...(opp.lead_id ? { lead: `/crm/leads/${opp.lead_id}` } : {}),
    opportunity: `/crm/opportunities/${opp.id}`,
    ...(activeQuote ? { quote: `/crm/quotes/${activeQuote.id}` } : {}),
    ...(existingOvf ? { ovf: `/crm/ovf/${existingOvf.id}` } : {}),
    ...(won && existingOvf ? { won: `/crm/ovf/${existingOvf.id}` } : {}),
  };
  const quoteFollowOnActions =
    blueprint.state === "quote_in_progress" && activeQuote
      ? (QUOTE_STAGE_ACTIONS[activeQuote.quote_stage] ?? [])
      : [];
  const ovfFollowOnActions =
    existingOvf && !existingOvf.locked && !existingOvf.deal_won
      ? (OVF_STAGE_ACTIONS[existingOvf.blueprint_state] ?? [])
      : [];
  const blueprintActions = Array.from(
    new Set([...blueprint.allowed_actions, ...quoteFollowOnActions, ...ovfFollowOnActions]),
  );

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

          <DealTimeline current={timelineStage} lost={lost} links={timelineLinks} />
          <ApprovalBanner locked={blueprint.locked} approvalStatus={blueprint.state} label="This opportunity" />

          <PageHeader
            title={`${opp.opportunity_name} · ${opp.opportunity_code}`}
            description={`Expected revenue ${formatInr(opp.expected_revenue)}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <DealTimelineStatusBadge
                  stage={timelineStage}
                  lost={lost}
                  timelineEvents={timelineEvents}
                />
                {canCreateQuote ? (
                  <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={onCreateQuote}>
                    <Plus className="size-3.5" /> Create Quote
                  </Button>
                ) : null}
                {canCreateOvf && acceptedQuote ? (
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => onCreateOvf(acceptedQuote)}
                  >
                    <Plus className="size-3.5" /> Create OVF
                  </Button>
                ) : null}
              </div>
            }
          />

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
            allowedActions={blueprintActions}
            locked={blueprint.locked}
            excludeActions={CUSTOM_ACTIONS}
            defaultValues={{
              deal_won_amount: activeQuote?.grand_total ?? existingOvf?.deal_won_amount ?? null,
            }}
            onAction={onBlueprintAction}
            disabled={busy}
          />

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
                  No quotes yet — use “Create Quote” to draft one.
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
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q) => (
                        <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-2 font-medium">
                            <Link href={`/crm/quotes/${q.id}`} className="cursor-pointer hover:underline">
                              {q.quote_no}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="capitalize">
                              {q.quote_stage.replaceAll("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">{formatInr(q.grand_total)}</td>
                          <td className="px-4 py-2">{q.avg_margin_pct}%</td>
                        </tr>
                      ))}
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
                  {acceptedQuote
                    ? "No OVF yet — use “Create OVF” after the customer PO is approved."
                    : "Create OVF once a Quote is accepted and the customer PO is approved."}
                </p>
              ) : (
                <div className="erp-scroll overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className={CRM_TABLE_HEAD_ROW}>
                        <th className="px-4 py-2">OVF No.</th>
                        <th className="px-4 py-2">State</th>
                        <th className="px-4 py-2">Deal Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ovfs.map((o) => (
                        <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-2 font-medium">
                            <Link href={`/crm/ovf/${o.id}`} className="cursor-pointer hover:underline">
                              {o.ovf_no}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="capitalize">
                              {o.blueprint_state.replaceAll("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            {o.deal_won ? formatInr(o.deal_won_amount ?? 0) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CrmListPanel>
          ) : null}

          {sourceLead ? (
            <LeadDetailsCard
              lead={sourceLead}
              company={company}
              employees={employees}
              leadSources={leadSources}
            />
          ) : opp.lead_id ? (
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

          <CrmSection title="Attachments" subtitle="BOQ / SOW / OEM / PO files" icon={Paperclip}>
            <EntityAttachmentsList
              attachments={attachments}
              entityType="opportunity"
              entityId={opportunityId}
              branchId={opp.branch_id}
              companyId={opp.company_id}
              onChanged={load}
            />
          </CrmSection>
        </CrmPage>
      </div>
    </div>
  );
}
