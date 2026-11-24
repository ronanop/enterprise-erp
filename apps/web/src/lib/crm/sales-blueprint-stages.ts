import type { BlueprintEntity } from "@/services/sales-crm-service";
import type { Opportunity, Ovf, Quote, SalesLead } from "@/services/sales-crm-service";

export type SalesStageContext = {
  entityType: BlueprintEntity;
  blueprintState: string;
  locked?: boolean;
  lead?: SalesLead | null;
  opportunity?: Opportunity | null;
  quote?: Quote | null;
  ovf?: Ovf | null;
  /** Opportunity detail - active quote + OVF for unified deal stage. */
  quotes?: Quote[];
  ovfs?: Ovf[];
};

function resolveQuoteStageLabel(
  quoteStage: string,
  locked?: boolean,
  quoteRevision?: number | null,
): string {
  const rev = Math.max(1, Number(quoteRevision) || 1);
  switch (quoteStage) {
    case "draft":
      return rev > 1 ? `V${rev} Draft` : "Quote Created";
    case "internal_approval":
      return locked ? "Quote Sent for Approval" : "Quote Sent for Approval";
    case "approved_internal":
      return "Quote Approved";
    case "sent_to_customer":
    case "negotiation":
    case "follow_up":
      return `Quote Sent V${rev}`;
    case "accepted":
      return rev > 1 ? `Deal Won · V${rev}` : "Deal Won";
    case "lost":
      return "Deal Lost";
    default:
      return quoteStage.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "-";
  }
}

function resolveOvfStageLabel(blueprintState: string, ovf: Ovf): string {
  if (ovf.deal_won || blueprintState === "deal_won") return "Deal Won";
  switch (blueprintState) {
    case "draft":
      return "OVF Created";
    case "approval":
      return ovf.locked ? "OVF Sent for Approval" : "OVF Sent for Approval";
    case "approved":
      return "OVF Approved";
    case "shared_scm":
      return "OVF Shared to SCM";
    default:
      return blueprintState.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "-";
  }
}

function resolveOpportunityBoqPending(opp: Opportunity): string {
  const { sow_attached, boq_attached, sow_approved, boq_approved } = opp;
  if (boq_approved && sow_approved) return "BOQ/SOW Attached";
  if (sow_approved && !boq_approved && boq_attached) return "SOW Studied";
  if (boq_approved && !sow_approved && sow_attached) return "BOQ Studied";
  if (sow_attached && boq_attached) {
    if (!sow_approved) return "SOW Attached";
    if (!boq_approved) return "BOQ Attached";
    return "BOQ/SOW Attached";
  }
  if (sow_attached && !sow_approved) return "SOW Attached";
  if (boq_attached && !boq_approved) return "BOQ Attached";
  if (boq_approved) return "BOQ Studied";
  if (sow_approved) return "SOW Studied";
  return "Opportunity Open";
}

function resolveOpportunityDealReg(opp: Opportunity): string {
  if (opp.boq_approved && opp.sow_approved) return "Deal Registration";
  if (opp.boq_approved) return "BOQ Studied";
  if (opp.sow_approved) return "SOW Studied";
  return "Deal Registration";
}

function resolveOpportunityPoPending(opp: Opportunity): string {
  if (opp.customer_po_attached && !opp.customer_po_approved) return "Customer PO Attached";
  return "Quote Accepted";
}

function resolveOpportunityBlueprintState(
  state: string,
  opp: Opportunity,
  locked?: boolean,
): string {
  if (state === "lost") return "Deal Lost";
  if (state === "won") return "Deal Won";

  switch (state) {
    case "open":
      return "Opportunity Open";
    case "boq_pending":
      return resolveOpportunityBoqPending(opp);
    case "sow_approval":
      return "SOW Sent for Approval";
    case "boq_approval":
      return "BOQ Sent for Approval";
    case "deal_reg":
      return resolveOpportunityDealReg(opp);
    case "oem_pending":
      return "Attach Vendor Quotation";
    case "oem_attached":
      return "Attach Vendor Quotation";
    case "quote_ready":
      return "Vendor Quotation Attached";
    case "quote_in_progress":
      return "Quote Created";
    case "po_pending":
      return resolveOpportunityPoPending(opp);
    case "po_approval":
      return locked ? "Customer PO Sent for Approval" : "Customer PO Sent for Approval";
    case "ovf_ready":
      return opp.customer_po_approved ? "OVF Ready" : "Customer PO Approved";
    default:
      return state.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "-";
  }
}

function resolveUnifiedOpportunityStage(ctx: SalesStageContext): string {
  const opp = ctx.opportunity!;
  const state = ctx.blueprintState || opp.blueprint_state || "open";

  if (state === "lost" || opp.status === "lost") return "Deal Lost";
  if (state === "won" || opp.status === "won") return "Deal Won";

  const ovf = ctx.ovf ?? ctx.ovfs?.[0];
  if (ovf) {
    if (ovf.deal_won) return "Deal Won";
    return resolveOvfStageLabel(ovf.blueprint_state, ovf);
  }

  if (state === "ovf_ready") return "OVF Ready";

  if (state === "po_approval") {
    return "Customer PO Sent for Approval";
  }

  const quote =
    ctx.quote ??
    ctx.quotes?.find((row) => row.quote_stage === "accepted") ??
    ctx.quotes?.[0];

  if (quote) {
    const quoteLabel = resolveQuoteStageLabel(quote.quote_stage, quote.locked, quote.quote_revision);
    const quotePastDraft = quote.quote_stage !== "draft";
    const oppInQuotePhase = ["quote_in_progress", "po_pending", "po_approval", "ovf_ready"].includes(
      state,
    );
    if (quotePastDraft || oppInQuotePhase || state === "quote_in_progress") {
      if (quote.quote_stage === "draft" && state === "quote_in_progress") {
        return quoteLabel;
      }
      if (quote.quote_stage !== "draft") {
        return quoteLabel;
      }
    }
  }

  return resolveOpportunityBlueprintState(state, opp, ctx.locked);
}

export function resolveSalesStageLabel(ctx: SalesStageContext): string {
  const state = ctx.blueprintState?.trim() || "open";

  switch (ctx.entityType) {
    case "lead": {
      if (state === "converted") return "Converted to Opportunity";
      if (state === "lost") return "Deal Lost";
      return ctx.lead?.created_at ? "Lead Open" : "Lead Open";
    }
    case "quote":
      return resolveQuoteStageLabel(
        state,
        ctx.locked ?? ctx.quote?.locked,
        ctx.quote?.quote_revision,
      );
    case "ovf":
      if (ctx.ovf) return resolveOvfStageLabel(state, ctx.ovf);
      return resolveOvfStageLabel(state, {
        blueprint_state: state,
        locked: ctx.locked ?? false,
        deal_won: state === "deal_won",
      } as Ovf);
    case "opportunity":
      if (!ctx.opportunity) {
        return resolveOpportunityBlueprintState(state, {} as Opportunity, ctx.locked);
      }
      return resolveUnifiedOpportunityStage(ctx);
    default:
      return state.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "-";
  }
}

/**
 * Stage color bands for status identification:
 * - pre_po (orange): Lead → … → Deal Won (inclusive)
 * - post_po (green): Customer PO / OVF path onward
 * - lost (red): Deal Lost
 */
export type SalesStageTone = "pre_po" | "post_po" | "lost" | "neutral";

const POST_PO_LABEL_RE =
  /customer\s*po|ovf\b|shared\s*to\s*scm|po\s*received|po\s*attached|po\s*approved|po\s*sent/i;

const POST_PO_STATE_RE =
  /^(po_pending|po_approval|ovf_ready|ovf_|shared_scm|customer_po)/i;

/** Classify a human stage label (Current State / timeline / reports). */
export function salesStageToneFromLabel(label: string | null | undefined): SalesStageTone {
  const text = (label || "").trim();
  if (!text || text === "-") return "neutral";
  const lower = text.toLowerCase();
  if (/\blost\b/.test(lower)) return "lost";
  // Deal Won stays orange even if it appears again later in the path.
  if (/^deal\s*won\b/.test(lower) || lower.includes("deal won ·")) return "pre_po";
  if (POST_PO_LABEL_RE.test(lower)) return "post_po";
  return "pre_po";
}

/** Classify a raw blueprint / quote / opportunity stage key. */
export function salesStageToneFromState(
  state: string | null | undefined,
  entityType?: BlueprintEntity | "opportunity" | "quote" | "ovf" | "lead" | string,
): SalesStageTone {
  const raw = (state || "").trim().toLowerCase();
  if (!raw) return "neutral";
  if (raw === "lost") return "lost";

  if (entityType === "ovf") {
    if (raw === "deal_won") return "post_po";
    return "post_po";
  }

  if (raw === "won" || raw === "accepted" || raw === "deal_won") return "pre_po";
  if (POST_PO_STATE_RE.test(raw)) return "post_po";
  if (entityType === "quote") return "pre_po";
  return "pre_po";
}

export function salesStageBadgeClassName(tone: SalesStageTone): string {
  switch (tone) {
    case "post_po":
      return "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "pre_po":
      return "border-orange-200 bg-orange-100 text-orange-900 hover:bg-orange-100";
    case "lost":
      return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10";
    default:
      return "border-border bg-muted text-muted-foreground hover:bg-muted";
  }
}
