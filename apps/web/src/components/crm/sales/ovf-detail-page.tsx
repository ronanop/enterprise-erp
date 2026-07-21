"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, Trophy } from "lucide-react";

import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { AttachmentsPanel } from "@/components/crm/sales/attachments-panel";
import { BlueprintActions, BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline } from "@/components/crm/sales/deal-timeline";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  addOvfLine,
  applyOvfAction,
  formatInr,
  formatInrPrecise,
  getOpportunity,
  getOvf,
  getOvfBlueprint,
  getQuote,
  listOvfLines,
  markOvfDealWon,
  sendOvfForApproval,
  shareOvfToScm,
  type BlueprintActionPayload,
  type BlueprintState,
  type Opportunity,
  type Ovf,
  type OvfLine,
  type Quote,
} from "@/services/sales-crm-service";

const SIDES = ["customer_po", "vendor"] as const;

export function OvfDetailPage({ ovfId }: { ovfId: string }) {
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [lines, setLines] = useState<OvfLine[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  const [lineDraft, setLineDraft] = useState({ side: "customer_po" as string, product_name: "", qty: "1", unit_price: "0" });
  const [addingLine, setAddingLine] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovfRow, bp, lineRows] = await Promise.all([
        getOvf(ovfId),
        getOvfBlueprint(ovfId),
        listOvfLines(ovfId).catch(() => []),
      ]);
      setOvf(ovfRow);
      setBlueprint(bp);
      setLines(lineRows);
      const [quoteRow, oppRow] = await Promise.all([
        getQuote(ovfRow.quote_id).catch(() => null),
        getOpportunity(ovfRow.opportunity_id).catch(() => null),
      ]);
      setQuote(quoteRow);
      setOpportunity(oppRow);
    } catch (err) {
      setOvf(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF");
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBlueprintAction(action: string, payload: BlueprintActionPayload) {
    setBusy(true);
    setError(null);
    try {
      if (action === "send_for_approval") {
        await sendOvfForApproval(ovfId, { team_role: payload.team_role, remarks: payload.remarks });
      } else if (action === "share_to_scm") {
        await shareOvfToScm(ovfId);
      } else if (action === "deal_won") {
        await markOvfDealWon(ovfId, payload.deal_won_amount ?? 0);
      } else {
        await applyOvfAction(ovfId, action, payload);
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

  async function onAddLine() {
    if (!lineDraft.product_name.trim()) {
      setError("Product / item name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addOvfLine(ovfId, {
        side: lineDraft.side,
        product_name: lineDraft.product_name,
        qty: Number(lineDraft.qty) || 1,
        unit_price: Number(lineDraft.unit_price) || 0,
      });
      setLineDraft({ side: lineDraft.side, product_name: "", qty: "1", unit_price: "0" });
      setAddingLine(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add line");
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
      <div className="space-y-3">
        <Link href="/crm/ovf" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
          <ArrowLeft className="size-3.5" /> OVF
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!ovf || !blueprint) return null;

  const customerLines = lines.filter((l) => l.side === "customer_po");
  const vendorLines = lines.filter((l) => l.side === "vendor");
  const readOnlyLines = ovf.locked || ovf.deal_won;
  const timelineLinks = {
    ...(opportunity?.company_account_id
      ? { company: `/crm/companies/${opportunity.company_account_id}` }
      : {}),
    ...(opportunity?.lead_id ? { lead: `/crm/leads/${opportunity.lead_id}` } : {}),
    opportunity: `/crm/opportunities/${ovf.opportunity_id}`,
    quote: `/crm/quotes/${ovf.quote_id}`,
    ovf: `/crm/ovf/${ovf.id}`,
    ...(ovf.deal_won ? { won: `/crm/ovf/${ovf.id}` } : {}),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/crm/ovf" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80">
          <ArrowLeft className="size-3.5" /> OVF
        </Link>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <DealTimeline
        current={ovf.deal_won ? "won" : "ovf"}
        links={timelineLinks}
        nextStep={
          ovf.deal_won
            ? undefined
            : {
                label: "Complete OVF",
                description: "Use the actions and order lines on this screen through Share to SCM and Deal Won.",
              }
        }
      />
      <ApprovalBanner locked={blueprint.locked} approvalStatus={ovf.approval_status} label="This OVF" />

      {ovf.deal_won ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950">
          <Trophy className="size-4" /> Deal Won at {formatInr(ovf.deal_won_amount ?? 0)} — the opportunity is now closed-won.
        </div>
      ) : null}

      <PageHeader
        title={ovf.ovf_no}
        description={quote ? `From Quote ${quote.quote_no}` : "Order Value Form"}
        actions={<BlueprintStateBadge state={blueprint.state} />}
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
        onAction={onBlueprintAction}
        disabled={busy}
      />

      <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">PO Number</dt>
          <dd className="mt-0.5 text-sm">{ovf.po_number ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Vendor Payment Days</dt>
          <dd className="mt-0.5 text-sm">{ovf.vendor_payment_days}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Customer Payment Days</dt>
          <dd className="mt-0.5 text-sm">{ovf.customer_payment_days}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Finance Cost %</dt>
          <dd className="mt-0.5 text-sm">{ovf.finance_cost_pct}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total Margin %</dt>
          <dd className="mt-0.5 text-sm font-medium">{ovf.total_margin_pct}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total Margin Amount</dt>
          <dd className="mt-0.5 text-sm">{formatInrPrecise(ovf.total_margin_amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Shared to SCM</dt>
          <dd className="mt-0.5 text-sm">{ovf.shared_to_scm ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Version</dt>
          <dd className="mt-0.5 text-sm">{ovf.version}</dd>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-medium tracking-tight">Order Lines</h2>
            <p className="text-[11px] text-muted-foreground">Customer PO side vs. Vendor side — drives the OVF margin.</p>
          </div>
          {!readOnlyLines ? (
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setAddingLine((v) => !v)}>
              <Plus className="size-3.5" /> Add line
            </Button>
          ) : null}
        </div>

        {addingLine ? (
          <div className="grid gap-2 border-b border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-4">
            <FinanceSelect value={lineDraft.side} onChange={(e) => setLineDraft((d) => ({ ...d, side: e.target.value }))}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {s === "customer_po" ? "Customer PO" : "Vendor"}
                </option>
              ))}
            </FinanceSelect>
            <Input
              placeholder="Product / item name *"
              value={lineDraft.product_name}
              onChange={(e) => setLineDraft((d) => ({ ...d, product_name: e.target.value }))}
              className="sm:col-span-2"
            />
            <Input
              type="number"
              min={1}
              placeholder="Qty"
              value={lineDraft.qty}
              onChange={(e) => setLineDraft((d) => ({ ...d, qty: e.target.value }))}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Unit price (₹)"
              value={lineDraft.unit_price}
              onChange={(e) => setLineDraft((d) => ({ ...d, unit_price: e.target.value }))}
            />
            <div className="flex justify-end sm:col-span-3">
              <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={() => void onAddLine()}>
                {busy ? "Saving…" : "Add line"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-px sm:grid-cols-2">
          {[
            { label: "Customer PO", rows: customerLines },
            { label: "Vendor", rows: vendorLines },
          ].map((group) => (
            <div key={group.label} className="p-3">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h3>
              {group.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lines yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="py-1">Item</th>
                      <th className="py-1">Qty</th>
                      <th className="py-1">Unit Price</th>
                      <th className="py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((line) => (
                      <tr key={line.id} className="border-b border-border/40 last:border-0">
                        <td className="py-1.5">{line.product_name}</td>
                        <td className="py-1.5">{line.qty}</td>
                        <td className="py-1.5">{formatInrPrecise(line.unit_price)}</td>
                        <td className="py-1.5 font-medium">{formatInrPrecise(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      <AttachmentsPanel
        entityType="ovf"
        entityId={ovf.id}
        branchId={ovf.branch_id}
        companyId={ovf.company_id}
        title="OVF Documents"
        categories={["customer_po", "vendor_invoice", "other"]}
        readOnly={ovf.locked}
      />
    </div>
  );
}
