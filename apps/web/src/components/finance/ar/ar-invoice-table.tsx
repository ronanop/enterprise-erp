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
import { useArTablePrefs } from "@/hooks/use-ar-table-prefs";
import { useUserDirectory } from "@/hooks/use-user-directory";
import {
  exportArInvoicesCsv,
  exportArInvoicesXlsx,
  printArInvoicesTable,
} from "@/lib/finance/ar-export";
import { cn } from "@/lib/utils";
import type { ArEntry } from "@/services/ar-service";
import { formatInrPrecise } from "@/services/finance-service";

export type ArSortKey =
  | "document_date"
  | "due_date"
  | "document_number"
  | "balance_amount"
  | "debit_amount"
  | "credit_amount"
  | "status"
  | "created_at";

type ColumnKey =
  | "invoice_no"
  | "customer"
  | "invoice_date"
  | "due_date"
  | "status"
  | "currency"
  | "outstanding"
  | "paid"
  | "balance"
  | "created_by";

const LABELS: Record<ColumnKey, string> = {
  invoice_no: "Invoice No",
  customer: "Customer",
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  status: "Status",
  currency: "Currency",
  outstanding: "Outstanding",
  paid: "Paid",
  balance: "Balance",
  created_by: "Created By",
};

type Props = {
  rows: ArEntry[];
  loading?: boolean;
  sortBy: ArSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: ArSortKey) => void;
  page: number;
  pageSize: number;
  total: number;
  totalOutstanding: number;
  totalPaid: number;
  totalBalance: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  detailHref?: (row: ArEntry) => string;
  exportTitle?: string;
};

export function ArInvoiceTable(props: Props) {
  const { prefs, setPrefs } = useArTablePrefs();
  const { resolve } = useUserDirectory();
  const [colsOpen, setColsOpen] = useState(false);
  const visible = useMemo(() => new Set(prefs.visibleColumns), [prefs.visibleColumns]);
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const detailHref = props.detailHref ?? ((row: ArEntry) => `/finance/accounts-receivable/invoices/${row.id}`);
  const exportTitle = props.exportTitle ?? "Accounts Receivable Invoices";

  const sortable: Partial<Record<ColumnKey, ArSortKey>> = {
    invoice_no: "document_number",
    invoice_date: "document_date",
    due_date: "due_date",
    outstanding: "balance_amount",
    paid: "credit_amount",
    balance: "balance_amount",
    status: "status",
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportArInvoicesCsv(props.rows)}>
          <Download className="size-3.5" /> CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportArInvoicesXlsx(props.rows)}>
          <FileSpreadsheet className="size-3.5" /> XLSX
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => printArInvoicesTable(exportTitle, props.rows)}>
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
                  <th key={key} className={cn("px-2 py-2 whitespace-nowrap", (key === "outstanding" || key === "paid" || key === "balance") && "text-right")}>
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
                  <tr key={i}><td colSpan={10} className="px-2 py-2"><div className="h-6 animate-pulse rounded bg-muted/70" /></td></tr>
                ))
              : null}
            {!props.loading && props.rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No AR entries match the current filters.</td></tr>
            ) : null}
            {!props.loading
              ? props.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/40">
                    {visible.has("invoice_no") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link href={detailHref(row)} className="cursor-pointer hover:underline">{row.document_number}</Link>
                      </td>
                    ) : null}
                    {visible.has("customer") ? (
                      <td className="px-2 py-1.5">
                        <Link href={`/finance/accounts-receivable/customers/${row.customer_id}`} className="cursor-pointer hover:underline">
                          {row.customer_name ?? row.customer_code ?? row.customer_id.slice(0, 8)}
                        </Link>
                      </td>
                    ) : null}
                    {visible.has("invoice_date") ? <td className="px-2 py-1.5 font-mono text-xs">{row.document_date}</td> : null}
                    {visible.has("due_date") ? <td className="px-2 py-1.5 font-mono text-xs">{row.due_date}</td> : null}
                    {visible.has("status") ? <td className="px-2 py-1.5"><FinanceStatusBadge status={row.status} /></td> : null}
                    {visible.has("currency") ? <td className="px-2 py-1.5 font-mono text-xs uppercase">{row.currency_code}</td> : null}
                    {visible.has("outstanding") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.outstanding_amount ?? row.balance_amount)}</td> : null}
                    {visible.has("paid") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.paid_amount ?? 0)}</td> : null}
                    {visible.has("balance") ? <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(row.balance_amount)}</td> : null}
                    {visible.has("created_by") ? <td className="px-2 py-1.5 text-xs text-muted-foreground">{resolve(row.created_by)}</td> : null}
                  </tr>
                ))
              : null}
          </tbody>
          <tfoot>
            <tr className="sticky bottom-0 border-t border-border/80 bg-muted/50 text-xs font-medium">
              <td colSpan={Math.max(1, Array.from(visible).filter((c) => !["outstanding", "paid", "balance"].includes(c)).length)} className="px-2 py-2">
                Sticky totals
              </td>
              {visible.has("outstanding") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalOutstanding)}</td> : null}
              {visible.has("paid") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalPaid)}</td> : null}
              {visible.has("balance") ? <td className="px-2 py-2 text-right font-mono tabular-nums">{formatInrPrecise(props.totalBalance)}</td> : null}
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
