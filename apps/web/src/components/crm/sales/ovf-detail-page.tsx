"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, Trophy } from "lucide-react";

import { ApprovalBanner } from "@/components/crm/sales/approval-banner";
import { AttachmentsPanel } from "@/components/crm/sales/attachments-panel";
import { BlueprintActions, BlueprintStateBadge } from "@/components/crm/sales/blueprint-actions";
import { DealTimeline } from "@/components/crm/sales/deal-timeline";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
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
  getCompany,
  getOpportunity,
  getOvf,
  getOvfBlueprint,
  getQuote,
  listEmployeeOptions,
  listOvfLines,
  markOvfDealWon,
  sendOvfForApproval,
  shareOvfToScm,
  type BlueprintActionPayload,
  type BlueprintState,
  type Company,
  type Opportunity,
  type Option,
  type Ovf,
  type OvfLine,
  type Quote,
} from "@/services/sales-crm-service";

const SIDES = ["customer_po", "vendor"] as const;

function textOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function OvfDetailPage({ ovfId }: { ovfId: string }) {
  const [ovf, setOvf] = useState<Ovf | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintState | null>(null);
  const [lines, setLines] = useState<OvfLine[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Option[]>([]);
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
      const [quoteRow, oppRow, employeeRows] = await Promise.all([
        getQuote(ovfRow.quote_id).catch(() => null),
        getOpportunity(ovfRow.opportunity_id).catch(() => null),
        listEmployeeOptions().catch(() => [] as Option[]),
      ]);
      setQuote(quoteRow);
      setOpportunity(oppRow);
      setEmployees(employeeRows);
      const accountId = ovfRow.company_account_id ?? oppRow?.company_account_id ?? null;
      setCompany(accountId ? await getCompany(accountId).catch(() => null) : null);
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
        await sendOvfForApproval(ovfId, { team_role: payload.team_role, remarks: payload.remarks });
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
        defaultValues={{ deal_won_amount: quote?.grand_total ?? null }}
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

      <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium tracking-tight">OVF Details</h2>

        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          OVF Module Information
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Customer Name">{customerName}</DetailItem>
          <DetailItem label="Quote Name">{quoteName}</DetailItem>
          <DetailItem label="Quote No.">{textOrDash(quote?.quote_no)}</DetailItem>
          <DetailItem label="Account">{accountName}</DetailItem>
          <DetailItem label="OVF Module Owner">{ownerName}</DetailItem>
          <DetailItem label="PO Number">{textOrDash(ovf.po_number)}</DetailItem>
          <DetailItem label="Delivery Period">{textOrDash(ovf.delivery_period)}</DetailItem>
          <DetailItem label="OVF No.">{ovf.ovf_no}</DetailItem>
          <DetailItem label="OVF sent to SCM team">{ovf.shared_to_scm ? "Yes" : "No"}</DetailItem>
          <DetailItem label="Approval Status">
            <FinanceStatusBadge status={ovf.approval_status} />
          </DetailItem>
          <DetailItem label="Blueprint State">
            <span className="capitalize">{ovf.blueprint_state.replaceAll("_", " ")}</span>
          </DetailItem>
          <DetailItem label="Opportunity">
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
          </DetailItem>
          <DetailItem label="Billing Address">
            <span className="whitespace-pre-wrap">{billingAddress}</span>
          </DetailItem>
          <DetailItem label="Billing State">{billingState}</DetailItem>
          <DetailItem label="Billing Country">{billingCountry}</DetailItem>
          <DetailItem label="Billing Contact Person">{billingContact}</DetailItem>
          <DetailItem label="Shipping Address">
            <span className="whitespace-pre-wrap">{shippingAddress}</span>
          </DetailItem>
          <DetailItem label="Shipping State">{shippingState}</DetailItem>
          <DetailItem label="Shipping Country">{shippingCountry}</DetailItem>
          <DetailItem label="Shipping Contact Person">{shippingContact}</DetailItem>
          <DetailItem label="Installation/Service Details">
            <span className="whitespace-pre-wrap">{textOrDash(ovf.installation_details)}</span>
          </DetailItem>
        </dl>

        <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Technology Segment &amp; Sub Technology Segment
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Technology Segment">{textOrDash(ovf.technology_segment)}</DetailItem>
          <DetailItem label="Sub Technology Segment">{textOrDash(ovf.sub_technology_segment)}</DetailItem>
        </dl>

        <h3 className="border-t border-border/70 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Charges and Details
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          <DetailItem label="Vendor Payment Terms (days)">{ovf.vendor_payment_days}</DetailItem>
          <DetailItem label="Customer Payment Term (days)">{ovf.customer_payment_days}</DetailItem>
          <DetailItem label="Finance Cost (%)">{ovf.finance_cost_pct}%</DetailItem>
          <DetailItem label="Total Margin in Percentage">{ovf.total_margin_pct}%</DetailItem>
          <DetailItem label="Total Margin in Amount">
            {formatInrPrecise(ovf.total_margin_amount)}
          </DetailItem>
          <DetailItem label="Freight Charges (₹)">{formatInr(ovf.freight)}</DetailItem>
          <DetailItem label="Additional Charges (₹)">{formatInr(ovf.additional_charges)}</DetailItem>
          <DetailItem label="Deal Won">{ovf.deal_won ? "Yes" : "No"}</DetailItem>
          <DetailItem label="Deal Won Amount">
            {ovf.deal_won_amount != null ? formatInr(ovf.deal_won_amount) : "—"}
          </DetailItem>
          <DetailItem label="Version">{ovf.version}</DetailItem>
        </dl>
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
