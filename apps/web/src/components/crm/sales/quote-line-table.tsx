"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  addQuoteLine,
  deleteQuoteLine,
  formatInrPrecise,
  updateQuoteLine,
  type QuoteLine,
} from "@/services/sales-crm-service";

const LINE_TYPES = ["hardware", "software", "services"];

type Draft = {
  product_name: string;
  hsn_sac: string;
  line_type: string;
  qty: string;
  unit_cost: string;
  unit_sell: string;
  margin_pct: string;
  gst_pct: string;
};

const EMPTY_DRAFT: Draft = {
  product_name: "",
  hsn_sac: "",
  line_type: "hardware",
  qty: "1",
  unit_cost: "0",
  unit_sell: "0",
  margin_pct: "0",
  gst_pct: "18",
};

function marginFromCostSell(cost: number, sell: number): number {
  if (!sell) return 0;
  return Number((((sell - cost) / sell) * 100).toFixed(3));
}

function sellFromCostMargin(cost: number, marginPct: number): number {
  const denom = 1 - marginPct / 100;
  if (denom <= 0) return cost;
  return Number((cost / denom).toFixed(4));
}

function ReverseMarginRow({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  function onCostChange(value: string) {
    const cost = Number(value) || 0;
    const sell = Number(draft.unit_sell) || 0;
    onChange({ ...draft, unit_cost: value, margin_pct: marginFromCostSell(cost, sell).toString() });
  }
  function onSellChange(value: string) {
    const sell = Number(value) || 0;
    const cost = Number(draft.unit_cost) || 0;
    onChange({ ...draft, unit_sell: value, margin_pct: marginFromCostSell(cost, sell).toString() });
  }
  function onMarginChange(value: string) {
    const marginPct = Number(value) || 0;
    const cost = Number(draft.unit_cost) || 0;
    onChange({ ...draft, margin_pct: value, unit_sell: sellFromCostMargin(cost, marginPct).toString() });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <span className="text-[10px] text-muted-foreground uppercase">Unit Cost (₹)</span>
        <Input type="number" step="0.01" value={draft.unit_cost} onChange={(e) => onCostChange(e.target.value)} />
      </div>
      <div>
        <span className="text-[10px] text-muted-foreground uppercase">Unit Sell (₹)</span>
        <Input type="number" step="0.01" value={draft.unit_sell} onChange={(e) => onSellChange(e.target.value)} />
      </div>
      <div>
        <span className="text-[10px] text-muted-foreground uppercase">Margin %</span>
        <Input type="number" step="0.01" value={draft.margin_pct} onChange={(e) => onMarginChange(e.target.value)} />
      </div>
    </div>
  );
}

export function QuoteLineTable({
  quoteId,
  lines,
  readOnly,
  initialDraft,
  onChanged,
}: {
  quoteId: string;
  lines: QuoteLine[];
  readOnly?: boolean;
  initialDraft?: Partial<Pick<Draft, "product_name" | "line_type">>;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAdd() {
    if (!adding) {
      setDraft({ ...EMPTY_DRAFT, ...initialDraft });
    }
    setAdding((value) => !value);
  }

  async function submitAdd() {
    if (!draft.product_name.trim()) {
      setError("Product name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addQuoteLine(quoteId, {
        product_name: draft.product_name,
        hsn_sac: draft.hsn_sac || null,
        line_type: draft.line_type,
        qty: Number(draft.qty) || 1,
        unit_cost: Number(draft.unit_cost) || 0,
        unit_sell: Number(draft.unit_sell) || 0,
        gst_pct: Number(draft.gst_pct) || 0,
      });
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add line");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(line: QuoteLine) {
    setEditingId(line.id);
    setEditDraft({
      product_name: line.product_name,
      hsn_sac: line.hsn_sac ?? "",
      line_type: line.line_type,
      qty: String(line.qty),
      unit_cost: String(line.unit_cost),
      unit_sell: String(line.unit_sell),
      margin_pct: String(line.margin_pct),
      gst_pct: String(line.gst_pct),
    });
  }

  async function submitEdit() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await updateQuoteLine(editingId, {
        product_name: editDraft.product_name,
        hsn_sac: editDraft.hsn_sac || null,
        line_type: editDraft.line_type,
        qty: Number(editDraft.qty) || 1,
        unit_cost: Number(editDraft.unit_cost) || 0,
        unit_sell: Number(editDraft.unit_sell) || 0,
        gst_pct: Number(editDraft.gst_pct) || 0,
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update line");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(lineId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteQuoteLine(lineId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete line");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Quote Lines</h2>
          <p className="text-[11px] text-muted-foreground">GST/HSN aware · reverse margin calculator (cost ↔ sell ↔ margin%)</p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={toggleAdd}>
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? "Cancel" : "Add line"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="border-b border-border/70 px-4 py-2 text-xs text-destructive">{error}</p> : null}

      {adding ? (
        <div className="space-y-2 border-b border-border/70 bg-muted/20 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Product name *"
              value={draft.product_name}
              onChange={(e) => setDraft((d) => ({ ...d, product_name: e.target.value }))}
            />
            <Input
              placeholder="HSN/SAC"
              value={draft.hsn_sac}
              onChange={(e) => setDraft((d) => ({ ...d, hsn_sac: e.target.value }))}
            />
            <FinanceSelect value={draft.line_type} onChange={(e) => setDraft((d) => ({ ...d, line_type: e.target.value }))}>
              {LINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </FinanceSelect>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">Qty</span>
              <Input type="number" min={1} value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase">GST %</span>
              <Input type="number" step="0.01" value={draft.gst_pct} onChange={(e) => setDraft((d) => ({ ...d, gst_pct: e.target.value }))} />
            </div>
          </div>
          <ReverseMarginRow draft={draft} onChange={setDraft} />
          <div className="flex justify-end">
            <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={() => void submitAdd()}>
              {busy ? "Saving…" : "Add line"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">HSN</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Cost</th>
              <th className="px-3 py-2">Sell</th>
              <th className="px-3 py-2">Margin %</th>
              <th className="px-3 py-2">GST %</th>
              <th className="px-3 py-2">Line Total</th>
              {!readOnly ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  No lines yet.
                </td>
              </tr>
            ) : (
              lines.map((line) =>
                editingId === line.id ? (
                  <tr key={line.id} className="border-b border-border/50 bg-muted/20 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{line.line_no}</td>
                    <td className="px-3 py-2" colSpan={9}>
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            value={editDraft.product_name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, product_name: e.target.value }))}
                          />
                          <Input
                            placeholder="HSN/SAC"
                            value={editDraft.hsn_sac}
                            onChange={(e) => setEditDraft((d) => ({ ...d, hsn_sac: e.target.value }))}
                          />
                          <FinanceSelect
                            value={editDraft.line_type}
                            onChange={(e) => setEditDraft((d) => ({ ...d, line_type: e.target.value }))}
                          >
                            {LINE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </FinanceSelect>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="number"
                            min={1}
                            value={editDraft.qty}
                            onChange={(e) => setEditDraft((d) => ({ ...d, qty: e.target.value }))}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={editDraft.gst_pct}
                            onChange={(e) => setEditDraft((d) => ({ ...d, gst_pct: e.target.value }))}
                          />
                        </div>
                        <ReverseMarginRow draft={editDraft} onChange={setEditDraft} />
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button type="button" size="icon-sm" className="cursor-pointer" disabled={busy} onClick={() => void submitEdit()}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" className="cursor-pointer" onClick={() => setEditingId(null)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={line.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono text-xs">{line.line_no}</td>
                    <td className="px-3 py-2">{line.product_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.hsn_sac ?? "—"}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{line.line_type}</td>
                    <td className="px-3 py-2">{line.qty}</td>
                    <td className="px-3 py-2">{formatInrPrecise(line.unit_cost)}</td>
                    <td className="px-3 py-2">{formatInrPrecise(line.unit_sell)}</td>
                    <td className="px-3 py-2">{line.margin_pct}%</td>
                    <td className="px-3 py-2">{line.gst_pct}%</td>
                    <td className="px-3 py-2 font-medium">{formatInrPrecise(line.line_total)}</td>
                    {!readOnly ? (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" className="cursor-pointer" onClick={() => startEdit(line)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer"
                            disabled={busy}
                            onClick={() => void onDelete(line.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
