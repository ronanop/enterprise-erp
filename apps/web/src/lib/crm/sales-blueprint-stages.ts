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
  /** Opportunity detail — active quote + OVF for unified deal stage. */
  quotes?: Quote[];
  ovfs?: Ovf[];
};

function resolveQuoteStageLabel(quoteStage: string, locked?: boolean): string {
  switch (quoteStage) {
    case "draft":
      return "Quote Created";
    case "internal_approval":
      return locked ? "Quote Sent for Approval" : "Quote Sent for Approval";
    case "approved_internal":
      return "Quote Approved";
    case "sent_to_customer":
    case "negotiation":
    case "follow_up":
      return "Quote Sent";
    case "accepted":
      return "Quote Accepted";
    case "lost":
      return "Lost Deal";
    default:
      return quoteStage.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
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
      return blueprintState.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
  }
}

function resolveOpportunityBoqPending(opp: Opportunity): string {
  const { sow_attached, boq_attached, sow_approved, boq_approved } = opp;
  if (sow_approved && !boq_approved && boq_attached) return "SOW Studied";
  if (boq_approved && !sow_approved && sow_attached) return "BOQ Studied";
  if (sow_attached && boq_attached) {
    if (!sow_approved) return "SOW Attached";
    if (!boq_approved) return "BOQ Attached";
  }
  if (sow_attached && !sow_approved) return "SOW Attached";
  if (boq_attached && !boq_approved) return "BOQ Attached";
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
  if (state === "lost") return "Lost Deal";
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
      return "Deal Registration Submitted";
    case "oem_attached":
      return "OEM Quotation Received";
    case "quote_ready":
      return "OEM Quote Attached";
    case "quote_in_progress":
      return "Quote Created";
    case "po_pending":
      return resolveOpportunityPoPending(opp);
    case "po_approval":
      return locked ? "Customer PO Sent for Approval" : "Customer PO Sent for Approval";
    case "ovf_ready":
      return opp.customer_po_approved ? "OVF Ready" : "Customer PO Approved";
    default:
      return state.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
  }
}

function resolveUnifiedOpportunityStage(ctx: SalesStageContext): string {
  const opp = ctx.opportunity!;
  const state = ctx.blueprintState || opp.blueprint_state || "open";

  if (state === "lost" || opp.status === "lost") return "Lost Deal";
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
    const quoteLabel = resolveQuoteStageLabel(quote.quote_stage, quote.locked);
    const quotePastDraft = quote.quote_stage !== "draft";
    const oppInQuotePhase = ["quote_in_progress", "po_pending", "po_approval", "ovf_ready"].includes(
      state,
    );
    if (quotePastDraft || oppInQuotePhase || state === "quote_in_progress") {
      if (quote.quote_stage === "draft" && state === "quote_in_progress") {
        return "Quote Created";
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
      if (state === "lost") return "Lost Deal";
      return ctx.lead?.created_at ? "Lead Open" : "Lead Open";
    }
    case "quote":
      return resolveQuoteStageLabel(state, ctx.locked ?? ctx.quote?.locked);
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
      return state.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
  }
}
