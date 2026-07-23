"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Paperclip, Plus, RefreshCw } from "lucide-react";

import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { BlueprintActions, BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline, type DealStage } from "@/components/crm/sales/deal-timeline";
import { LeadDetailsCard } from "@/components/crm/sales/lead-details-card";
import { CompanyWorkspaceNav } from "@/components/crm/company-workspace-nav";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setCrmSidebarFocus } from "@/lib/crm-sidebar-focus";
import { ApiClientError } from "@/services/api-client";
import {
  applyOpportunityAction,
  formatInr,
  getCompany,
  getOpportunity,
  getOpportunityBlueprint,
  getSalesLead,
  listAttachments,
  listEmployeeOptions,
  listOvfs,
  listQuotes,
  type Attachment,
  type BlueprintState,
  type Company,
  type Opportunity,
  type Option,
  type Ovf,
  type Quote,
  type SalesLead,
} from "@/services/sales-crm-service";

const CUSTOM_ACTIONS = ["create_quote", "quote_accepted", "create_ovf", "deal_won"];

export function OpportunityDetailPage({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [sourceLead, setSourceLead] = useState<SalesLead | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [ovfs, setOvfs] = useState<Ovf[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppRow, bp, employeeOptions] = await Promise.all([
        getOpportunity(opportunityId),
        getOpportunityBlueprint(opportunityId),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setOpp(oppRow);
      setBlueprint(bp);
      setEmployees(employeeOptions);
      const [quoteRows, ovfRows, attachmentRows, leadRow, companyRow] = await Promise.all([
        listQuotes({ opportunity_id: opportunityId }).catch(() => []),
        listOvfs({ opportunity_id: opportunityId }).catch(() => []),
        listAttachments("opportunity", opportunityId).catch(() => []),
        oppRow.lead_id ? getSalesLead(oppRow.lead_id).catch(() => null) : Promise.resolve(null),
        oppRow.company_account_id
          ? getCompany(oppRow.company_account_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      setQuotes(quoteRows);
      setOvfs(ovfRows);
      setAttachments(attachmentRows);
      setSourceLead(leadRow);
      setCompany(companyRow);
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
  }, [opportunityId]);

  async function onBlueprintAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setBanner(null);
    try {
      await applyOpportunityAction(opportunityId, action, payload);
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
      <div className="space-y-3">
        <Link href="/crm/opportunities" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> Opportunities
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
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
    !!acceptedQuote;
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
  const nextStep = existingOvf
    ? {
        label: won ? "Review Won Deal" : "Continue OVF",
        description: won
          ? "The blueprint is complete. Review the final OVF and deal value."
          : "Complete approval, SCM sharing, and Deal Won actions on the OVF.",
        href: `/crm/ovf/${existingOvf.id}`,
      }
    : canCreateOvf && acceptedQuote
      ? {
          label: "Create OVF",
          description: "The customer PO is approved. Create the OVF from this screen.",
          href: `/crm/quotes/${acceptedQuote.id}/ovf/new`,
        }
      : acceptedQuote
      ? {
          label: "Complete Customer PO",
          description: "Attach the customer PO and complete its approval using the actions below.",
        }
      : activeQuote
        ? {
            label: "Continue Quote",
            description: "Complete quote lines, approval, customer submission, and acceptance.",
            href: `/crm/quotes/${activeQuote.id}`,
          }
        : canCreateQuote
          ? {
              label: "Create Quote",
              description: "The OEM quote is ready. Create the customer quote from this screen.",
              href: `/crm/opportunities/${opp.id}/quotes/new`,
            }
          : {
              label: "Complete Opportunity Stage",
              description: "Use the available blueprint action below to advance the deal.",
            };

  return (
    <div className="flex min-w-0 items-start gap-4">
      {opp.company_account_id ? (
        <CompanyWorkspaceNav
          companyAccountId={opp.company_account_id}
          scope="opportunity"
          opportunityId={opportunityId}
          opportunity={opp}
          company={company}
        />
      ) : null}

      <div className="min-w-0 flex-1 space-y-4 overflow-x-clip">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/crm/opportunities" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
          <ArrowLeft className="size-3.5" /> Opportunities
        </Link>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <DealTimeline current={timelineStage} lost={lost} links={timelineLinks} nextStep={nextStep} />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={blueprint.state} label="This opportunity" />

      <PageHeader
        title={`${opp.opportunity_name} · ${opp.opportunity_code}`}
        description={`Expected revenue ${formatInr(opp.expected_revenue)} · Probability ${opp.probability_percent}%`}
        actions={<BlueprintStateBadge state={blueprint.state} />}
      />

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

      <BlueprintActions
        allowedActions={blueprint.allowed_actions}
        locked={blueprint.locked}
        excludeActions={CUSTOM_ACTIONS}
        onAction={onBlueprintAction}
        disabled={busy}
      />

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Project Title</dt>
          <dd className="mt-0.5 text-sm">{opp.project_title || opp.opportunity_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Account Name</dt>
          <dd className="mt-0.5 text-sm">{company?.customer_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Owner</dt>
          <dd className="mt-0.5 text-sm">
            {employees.find((row) => row.id === opp.owner_employee_id)?.label || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-0.5"><FinanceStatusBadge status={opp.status} /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Legacy Stage</dt>
          <dd className="mt-0.5 text-sm capitalize">{opp.current_stage.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Forecast Amount</dt>
          <dd className="mt-0.5 text-sm">{opp.forecast_amount != null ? formatInr(opp.forecast_amount) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expected Revenue</dt>
          <dd className="mt-0.5 text-sm">{formatInr(opp.expected_revenue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Probability</dt>
          <dd className="mt-0.5 text-sm">{opp.probability_percent}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Version</dt>
          <dd className="mt-0.5 text-sm">{opp.version}</dd>
        </div>
      </section>

      {showQuotes ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
              <FileText className="size-3.5" /> Quotes
            </h2>
            {canCreateQuote ? (
              <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={onCreateQuote}>
                <Plus className="size-3.5" /> Create Quote
              </Button>
            ) : null}
          </div>
          {quotes.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground">
              No quotes yet — use “Create Quote” to draft one.
            </p>
          ) : (
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
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
        </section>
      ) : null}

      {showOvf ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
              <FileText className="size-3.5" /> OVF
            </h2>
            {canCreateOvf && acceptedQuote ? (
              <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={() => onCreateOvf(acceptedQuote)}>
                <Plus className="size-3.5" /> Create OVF
              </Button>
            ) : null}
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
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
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
        </section>
      ) : null}

      {sourceLead ? (
        <LeadDetailsCard
          lead={sourceLead}
          company={company}
          employees={employees}
          headerAction={
            <Link
              href={`/crm/leads/${sourceLead.id}`}
              className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted/50"
            >
              Open Lead
            </Link>
          }
        />
      ) : opp.lead_id ? (
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Source lead could not be loaded.{" "}
            <Link
              href={`/crm/leads/${opp.lead_id}`}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              Open lead
            </Link>
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <Paperclip className="size-3.5" /> Attachments
        </h2>
        {attachments.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No BOQ / SOW / OEM / PO files attached yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-xs">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                <span className="truncate">{a.file_name}</span>
                <Badge variant="secondary" className="capitalize">
                  {a.category.replaceAll("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
