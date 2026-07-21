"use client";

import { formatInrPrecise } from "@/services/finance-service";
import type { GlTrialBalancePreview } from "@/services/gl-service";

type Props = {
  preview: GlTrialBalancePreview | null;
  loading?: boolean;
};

export function GlTrialBalancePreviewPanel({ preview, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Trial Balance Preview</h3>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Trial Balance Preview</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Ledger summary preview (not the full Trial Balance report). Apply fiscal year or period filters to load.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Trial Balance Preview</h3>
          <p className="mt-1 text-xs text-muted-foreground">Opening · Debit · Credit · Closing — ledger summary only</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${Math.abs(preview.difference) < 0.01 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          Diff {formatInrPrecise(preview.difference)}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <th className="px-1.5 py-1.5">Account</th>
              <th className="px-1.5 py-1.5 text-right">Opening</th>
              <th className="px-1.5 py-1.5 text-right">Debit</th>
              <th className="px-1.5 py-1.5 text-right">Credit</th>
              <th className="px-1.5 py-1.5 text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {preview.lines.slice(0, 12).map((line) => (
              <tr key={line.account_id} className="border-b border-border/40">
                <td className="px-1.5 py-1.5">
                  <span className="font-mono">{line.account_code}</span>
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  {line.account_name}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">{formatInrPrecise(line.opening)}</td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">{formatInrPrecise(line.debit)}</td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">{formatInrPrecise(line.credit)}</td>
                <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">{formatInrPrecise(line.closing)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/70 font-medium">
              <td className="px-1.5 py-2">Totals</td>
              <td className="px-1.5 py-2 text-right font-mono tabular-nums">{formatInrPrecise(preview.total_opening)}</td>
              <td className="px-1.5 py-2 text-right font-mono tabular-nums">{formatInrPrecise(preview.total_debit)}</td>
              <td className="px-1.5 py-2 text-right font-mono tabular-nums">{formatInrPrecise(preview.total_credit)}</td>
              <td className="px-1.5 py-2 text-right font-mono tabular-nums">{formatInrPrecise(preview.total_closing)}</td>
            </tr>
          </tfoot>
        </table>
        {preview.lines.length > 12 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Showing 12 of {preview.lines.length} accounts. Full Trial Balance is a separate report.</p>
        ) : null}
      </div>
    </div>
  );
}
