"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import {
  addJournalLine,
  deleteJournalLine,
  isJournalEditable,
  reorderJournalLines,
  updateJournalLine,
  type Journal,
  type JournalLine,
} from "@/services/journal-service";

type Option = { id: string; label: string };

type Props = {
  journal: Journal;
  accounts: Option[];
  costCenters: Option[];
  taxes: Option[];
  onChanged: () => void;
  onMessage: (msg: string, tone: "success" | "error") => void;
};

type DraftLine = JournalLine & { _dirty?: boolean };

export function JournalLinesEditor({
  journal,
  accounts,
  costCenters,
  taxes,
  onChanged,
  onMessage,
}: Props) {
  const editable = isJournalEditable(journal.status);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    [...(journal.lines ?? [])].sort((a, b) => a.line_number - b.line_number),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    setLines([...(journal.lines ?? [])].sort((a, b) => a.line_number - b.line_number));
  }, [journal.id, journal.updated_at, journal.total_debit, journal.total_credit, journal.lines]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
    const credit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
    const difference = Number((debit - credit).toFixed(4));
    return { debit, credit, difference, balanced: Math.abs(difference) < 0.0001 };
  }, [lines]);

  function patchLocal(id: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch, _dirty: true } : l)),
    );
  }

  async function saveLine(line: DraftLine) {
    if (!line.id || !editable) return;
    setBusyId(line.id);
    setOverlay(true);
    try {
      await updateJournalLine(journal.id, line.id, {
        account_id: line.account_id,
        debit_amount: Number(line.debit_amount) || 0,
        credit_amount: Number(line.credit_amount) || 0,
        description: line.description || null,
        cost_center_id: line.cost_center_id || null,
        tax_id: line.tax_id || null,
        line_number: line.line_number,
      });
      onMessage("Line saved.", "success");
      onChanged();
    } catch (err) {
      onMessage(err instanceof ApiClientError ? err.message : "Failed to save line", "error");
    } finally {
      setBusyId(null);
      setOverlay(false);
    }
  }

  async function insertLine(afterIndex: number) {
    if (!editable) return;
    setOverlay(true);
    try {
      const account = accounts[0];
      if (!account) {
        onMessage("No posting accounts available.", "error");
        return;
      }
      await addJournalLine(journal.id, {
        line_number: afterIndex + 2,
        account_id: account.id,
        debit_amount: 0,
        credit_amount: 0.01,
        description: "New line",
      });
      onMessage("Line inserted.", "success");
      onChanged();
    } catch (err) {
      onMessage(err instanceof ApiClientError ? err.message : "Failed to insert line", "error");
    } finally {
      setOverlay(false);
    }
  }

  async function duplicateLine(line: DraftLine) {
    if (!editable || !line.account_id) return;
    setOverlay(true);
    try {
      await addJournalLine(journal.id, {
        line_number: lines.length + 1,
        account_id: line.account_id,
        debit_amount: Number(line.debit_amount) || 0,
        credit_amount: Number(line.credit_amount) || 0,
        description: line.description || null,
        cost_center_id: line.cost_center_id || null,
        tax_id: line.tax_id || null,
      });
      onMessage("Line duplicated.", "success");
      onChanged();
    } catch (err) {
      onMessage(
        err instanceof ApiClientError ? err.message : "Failed to duplicate line",
        "error",
      );
    } finally {
      setOverlay(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setOverlay(true);
    try {
      await deleteJournalLine(journal.id, deleteId);
      setDeleteId(null);
      onMessage("Line deleted.", "success");
      onChanged();
    } catch (err) {
      onMessage(err instanceof ApiClientError ? err.message : "Failed to delete line", "error");
    } finally {
      setOverlay(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!editable) return;
    const next = index + direction;
    if (next < 0 || next >= lines.length) return;
    const ordered = [...lines];
    const tmp = ordered[index];
    ordered[index] = ordered[next];
    ordered[next] = tmp;
    const ids = ordered.map((l) => l.id!).filter(Boolean);
    setOverlay(true);
    try {
      await reorderJournalLines(journal.id, ids);
      onMessage("Lines reordered.", "success");
      onChanged();
    } catch (err) {
      onMessage(
        err instanceof ApiClientError ? err.message : "Failed to reorder lines",
        "error",
      );
    } finally {
      setOverlay(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      {overlay ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm">
          Working…
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium tracking-tight">Journal lines</h2>
          <p
            className={cn(
              "text-[11px] font-mono",
              totals.balanced ? "text-emerald-700" : "text-destructive",
            )}
          >
            Debit {formatInrPrecise(totals.debit)} · Credit{" "}
            {formatInrPrecise(totals.credit)} · Diff{" "}
            {formatInrPrecise(totals.difference)}
            {totals.balanced ? " · balanced" : " · unbalanced"}
          </p>
        </div>
        {editable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => void insertLine(lines.length - 1)}
          >
            <Plus className="size-3.5" />
            Insert line
          </Button>
        ) : null}
      </div>

      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Debit</th>
              <th className="px-3 py-2">Credit</th>
              <th className="px-3 py-2">Cost center</th>
              <th className="px-3 py-2">Tax</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id ?? index} className="border-b border-border/50 align-top">
                <td className="px-3 py-2 font-mono text-xs">{line.line_number}</td>
                <td className="px-3 py-2">
                  {editable ? (
                    <FinanceSelect
                      className="min-w-[160px]"
                      value={line.account_id}
                      onChange={(e) => patchLocal(line.id!, { account_id: e.target.value })}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </FinanceSelect>
                  ) : (
                    <span className="text-xs">
                      {accounts.find((a) => a.id === line.account_id)?.label ??
                        line.account_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <Input
                      value={line.description ?? ""}
                      onChange={(e) =>
                        patchLocal(line.id!, { description: e.target.value })
                      }
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {line.description || "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.debit_amount}
                      onChange={(e) =>
                        patchLocal(line.id!, {
                          debit_amount: Number(e.target.value) || 0,
                          credit_amount: 0,
                        })
                      }
                    />
                  ) : (
                    <span className="font-mono text-xs">
                      {formatInrPrecise(line.debit_amount)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.credit_amount}
                      onChange={(e) =>
                        patchLocal(line.id!, {
                          credit_amount: Number(e.target.value) || 0,
                          debit_amount: 0,
                        })
                      }
                    />
                  ) : (
                    <span className="font-mono text-xs">
                      {formatInrPrecise(line.credit_amount)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <FinanceSelect
                      value={line.cost_center_id ?? ""}
                      onChange={(e) =>
                        patchLocal(line.id!, {
                          cost_center_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {costCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </FinanceSelect>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {line.cost_center_id?.slice(0, 8) ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <FinanceSelect
                      value={line.tax_id ?? ""}
                      onChange={(e) =>
                        patchLocal(line.id!, { tax_id: e.target.value || null })
                      }
                    >
                      <option value="">—</option>
                      {taxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </FinanceSelect>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {line.tax_id?.slice(0, 8) ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable && line.id ? (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={busyId === line.id || !line._dirty}
                        onClick={() => void saveLine(line)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => void duplicateLine(line)}
                        aria-label="Duplicate"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={index === 0}
                        onClick={() => void move(index, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={index === lines.length - 1}
                        onClick={() => void move(index, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={lines.length <= 2}
                        onClick={() => setDeleteId(line.id!)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete journal line?"
        description="This soft-deletes the line and recalculates totals."
        confirmLabel="Delete"
        tone="destructive"
        busy={overlay}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
