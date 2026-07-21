"use client";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { exportPeriodsCsv, exportPeriodsXlsx } from "@/lib/finance/fiscal-export";
import { quarterLabel } from "@/lib/finance/period-utils";
import { cn } from "@/lib/utils";
import { periodStatusLabel, type AccountingPeriod } from "@/services/fiscal-service";

type Props = {
  rows: AccountingPeriod[];
  loading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onAction?: (action: string, ids: string[]) => void;
  busy?: boolean;
};

export function PeriodEnterpriseTable({
  rows,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onAction,
  busy,
}: Props) {
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const selected = Array.from(selectedIds);

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => exportPeriodsCsv(rows.filter((r) => selected.length === 0 || selectedIds.has(r.id)))}>CSV</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => exportPeriodsXlsx(rows.filter((r) => selected.length === 0 || selectedIds.has(r.id)))}>XLSX</Button>
        {selected.length > 0 && onAction ? (
          <>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={busy} onClick={() => onAction("open", selected)}>Bulk Open</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={busy} onClick={() => onAction("close", selected)}>Bulk Close</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={busy} onClick={() => onAction("lock", selected)}>Bulk Lock</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={busy} onClick={() => onAction("unlock", selected)}>Bulk Unlock</Button>
          </>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">{selected.length > 0 ? `${selected.length} selected · ` : ""}{rows.length} periods</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <th className="w-10 px-2 py-2"><input type="checkbox" className="cursor-pointer" checked={allSelected} onChange={() => onToggleSelectAll(allIds)} /></th>
              <th className="px-2 py-2">Month</th>
              <th className="px-2 py-2">Quarter</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Open Date</th>
              <th className="px-2 py-2">Close Date</th>
              <th className="px-2 py-2">Locked</th>
              <th className="px-2 py-2">Year</th>
              <th className="px-2 py-2 text-right">Journals</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={9} className="px-2 py-2"><div className="h-6 animate-pulse rounded bg-muted/70" /></td></tr>
            )) : null}
            {!loading && rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No periods for the selected fiscal year.</td></tr>
            ) : null}
            {!loading ? rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-border/50 hover:bg-muted/40", selectedIds.has(row.id) && "bg-accent/40")}>
                <td className="px-2 py-1.5"><input type="checkbox" className="cursor-pointer" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)} /></td>
                <td className="px-2 py-1.5 font-medium">{row.period_name}</td>
                <td className="px-2 py-1.5 text-xs">{quarterLabel(row.quarter)}</td>
                <td className="px-2 py-1.5"><FinanceStatusBadge status={row.status} /></td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.start_date}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.end_date}</td>
                <td className="px-2 py-1.5 text-xs">{row.gl_closed || row.status === "hard_closed" ? "Yes" : "No"}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.fiscal_year_code ?? "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{row.journal_count ?? 0}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { periodStatusLabel };
