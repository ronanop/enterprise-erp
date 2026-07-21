"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  FileSpreadsheet,
  Printer,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { useGlTablePrefs } from "@/hooks/use-gl-table-prefs";
import { exportGlCsv, exportGlXlsx, printGlTable } from "@/lib/finance/gl-export";
import { cn } from "@/lib/utils";
import { formatInrPrecise } from "@/services/finance-service";
import type { GlEntry } from "@/services/gl-service";

export type GlSortKey =
  | "entry_date"
  | "entry_number"
  | "account_code"
  | "debit_amount"
  | "credit_amount"
  | "posted_at";

type ColumnKey =
  | "journal"
  | "voucher"
  | "date"
  | "fiscal_year"
  | "period"
  | "account_code"
  | "account_name"
  | "cost_center"
  | "project"
  | "debit"
  | "credit"
  | "running"
  | "status";

const LABELS: Record<ColumnKey, string> = {
  journal: "Journal No",
  voucher: "Voucher No",
  date: "Posting Date",
  fiscal_year: "Fiscal Year",
  period: "Period",
  account_code: "Account Code",
  account_name: "Account Name",
  cost_center: "Cost Center",
  project: "Project",
  debit: "Debit",
  credit: "Credit",
  running: "Running Balance",
  status: "Status",
};

type Props = {
  rows: GlEntry[];
  loading?: boolean;
  sortBy: GlSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: GlSortKey) => void;
  page: number;
  pageSize: number;
  total: number;
  totalDebit: number;
  totalCredit: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
};

export function GlEnterpriseTable(props: Props) {
  const { prefs, setPrefs } = useGlTablePrefs();
  const [colsOpen, setColsOpen] = useState(false);
  const visible = useMemo(() => new Set(prefs.visibleColumns), [prefs.visibleColumns]);
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));

  const sortable: Partial<Record<ColumnKey, GlSortKey>> = {
    date: "entry_date",
    voucher: "entry_number",
    account_code: "account_code",
    debit: "debit_amount",
    credit: "credit_amount",
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportGlCsv(props.rows)}>
          <Download className="size-3.5" /> CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportGlXlsx(props.rows)}>
          <FileSpreadsheet className="size-3.5" /> XLSX
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => printGlTable("General Ledger Inquiry", props.rows)}>
          <Printer className="size-3.5" /> Print
        </Button>
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setColsOpen((v) => !v)}>
            <Columns3 className="size-3.5" /> Columns
          </Button>
          {colsOpen ? (
            <div className="absolute top-9 left-0 z-20 max-h-64 w-52 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md">
              {(Object.keys(LABELS) as ColumnKey[]).map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={visible.has(key)}
                    onChange={() => {
                      setPrefs((p) => {
                        const set = new Set(p.visibleColumns);
                        if (set.has(key)) set.delete(key);
                        else set.add(key);
                        return { ...p, visibleColumns: Array.from(set) };
                      });
                    }}
                  />
                  {LABELS[key]}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{props.total} entries</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {(Object.keys(LABELS) as ColumnKey[]).map((key) => {
                if (!visible.has(key)) return null;
                const sk = sortable[key];
                return (
                  <th key={key} className={cn("px-2 py-2 whitespace-nowrap", (key === "debit" || key === "credit" || key === "running") && "text-right")}>
                    {sk ? (
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground" onClick={() => props.onSort(sk)}>
                        {LABELS[key]}
                        {props.sortBy === sk ? (props.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      LABELS[key]
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {props.loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={13} className="px-2 py-2"><div className="h-6 animate-pulse rounded bg-muted/70" /></td></tr>
                ))
              : null}
            {!props.loading && props.rows.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-muted-foreground">No ledger entries match the current filters.</td></tr>
            ) : null}
            {!props.loading
              ? props.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/40">
                    {visible.has("journal") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {row.journal_header_id ? (
                          <Link href={`/finance/journals/${row.journal_header_id}`} className="cursor-pointer hover:underline">{row.journal_number ?? "—"}</Link>
                        ) : (row.journal_number ?? "—")}
                      </td>
                    ) : null}
                    {visible.has("voucher") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link href={`/finance/general-ledger/${row.id}`} className="cursor-pointer hover:underline">{row.entry_number}</Link>
                      </td>
                    ) : null}
                    {visible.has("date") ? <td className="px-2 py-1.5 font-mono text-xs">{row.entry_date}</td> : null}
                    {visible.has("fiscal_year") ? <td className="px-2 py-1.5 text-xs">{row.fiscal_year_code ?? "—"}</td> : null}
                    {visible.has("period") ? <td className="px-2 py-1.5 text-xs">{row.period_name ?? "—"}</td> : null}
                    {visible.has("account_code") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link href={`/finance/general-ledger/accounts/${row.account_id}`} className="cursor-pointer hover:underline">{row.account_code}</Link>
                      </td>
                    ) : null}
                    {visible.has("account_name") ? <td className="px-2 py-1.5">{row.account_name ?? "—"}</td> : null}
                    {visible.has("cost_center") ? <td className="px-2 py-1.5 text-xs text-muted-foreground">{row.cost_center_name ?? (row.cost_center_id ? row.cost_center_id.slice(0, 8) : "—")}</td> : null}
                    {visible.has("project") ? <td className="px-2 py-1.5 text-xs text-muted-foreground">{row.project_ref ?? "—"}</td> : null}
                    {visible.has("debit") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.base_debit_amount)}</td> : null}
                    {visible.has("credit") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.base_credit_amount)}</td> : null}
                    {visible.has("running") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{row.running_balance != null ? formatInrPrecise(row.running_balance) : "—"}</td> : null}
                    {visible.has("status") ? <td className="px-2 py-1.5"><FinanceStatusBadge status={row.journal_status ?? "posted"} /></td> : null}
                  </tr>
                ))
              : null}
          </tbody>
          <tfoot>
            <tr className="sticky bottom-0 border-t border-border/80 bg-muted/50 text-xs font-medium">
              <td colSpan={Math.max(1, Array.from(visible).filter((c) => !["debit", "credit", "running", "status"].includes(c)).length)} className="px-2 py-2">
                Sticky totals
              </td>
              {visible.has("debit") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalDebit)}</td> : null}
              {visible.has("credit") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalCredit)}</td> : null}
              {visible.has("running") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalDebit - props.totalCredit)}</td> : null}
              {visible.has("status") ? <td className="px-2 py-2" /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
        <select className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm" value={props.pageSize} onChange={(e) => props.onPageSizeChange(Number(e.target.value))}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {props.page} / {pageCount}</span>
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" disabled={props.page >= pageCount} onClick={() => props.onPageChange(props.page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
