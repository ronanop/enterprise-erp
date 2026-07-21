"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, FileSpreadsheet } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { useFiscalTablePrefs } from "@/hooks/use-fiscal-table-prefs";
import { exportFiscalYearsCsv, exportFiscalYearsXlsx } from "@/lib/finance/fiscal-export";
import { cn } from "@/lib/utils";
import type { FiscalYear } from "@/services/fiscal-service";

export type FiscalSortKey =
  | "fiscal_year_code"
  | "fiscal_year_name"
  | "start_date"
  | "end_date"
  | "status"
  | "created_at";

type ColumnKey = "select" | "code" | "name" | "start" | "end" | "status" | "closed" | "created_by" | "updated";

const LABELS: Record<Exclude<ColumnKey, "select">, string> = {
  code: "Fiscal Year Code",
  name: "Name",
  start: "Start Date",
  end: "End Date",
  status: "Status",
  closed: "Closed",
  created_by: "Created By",
  updated: "Last Updated",
};

type Props = {
  rows: FiscalYear[];
  loading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  sortBy: FiscalSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: FiscalSortKey) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  resolveUser?: (id?: string | null) => string;
};

export function FiscalEnterpriseTable(props: Props) {
  const { prefs, setPrefs } = useFiscalTablePrefs();
  const [colsOpen, setColsOpen] = useState(false);
  const visible = useMemo(() => new Set(prefs.visibleColumns), [prefs.visibleColumns]);
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const allIds = props.rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => props.selectedIds.has(id));
  const exportRows = props.rows.filter(
    (r) => props.selectedIds.size === 0 || props.selectedIds.has(r.id),
  );
  const sortable: Partial<Record<ColumnKey, FiscalSortKey>> = {
    code: "fiscal_year_code",
    name: "fiscal_year_name",
    start: "start_date",
    end: "end_date",
    status: "status",
    updated: "created_at",
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportFiscalYearsCsv(exportRows, props.resolveUser)}>
          <Download className="size-3.5" /> CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => exportFiscalYearsXlsx(exportRows, props.resolveUser)}>
          <FileSpreadsheet className="size-3.5" /> XLSX
        </Button>
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setColsOpen((v) => !v)}>
            <Columns3 className="size-3.5" /> Columns
          </Button>
          {colsOpen ? (
            <div className="absolute top-9 left-0 z-20 w-52 rounded-lg border border-border bg-card p-2 shadow-md">
              {(Object.keys(LABELS) as Array<Exclude<ColumnKey, "select">>).map((key) => (
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
        <span className="ml-auto text-xs text-muted-foreground">{props.total} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {visible.has("select") ? (
                <th className="w-10 px-2 py-2">
                  <input type="checkbox" className="cursor-pointer" checked={allSelected} onChange={() => props.onToggleSelectAll(allIds)} />
                </th>
              ) : null}
              {(Object.keys(LABELS) as Array<Exclude<ColumnKey, "select">>).map((key) => {
                if (!visible.has(key)) return null;
                const sk = sortable[key];
                return (
                  <th key={key} className="px-2 py-2 whitespace-nowrap">
                    {sk ? (
                      <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground" onClick={() => props.onSort(sk)}>
                        {LABELS[key]}
                        {props.sortBy === sk ? props.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
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
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={10} className="px-2 py-2"><div className="h-6 animate-pulse rounded bg-muted/70" /></td></tr>
                ))
              : null}
            {!props.loading && props.rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No fiscal years found.</td></tr>
            ) : null}
            {!props.loading
              ? props.rows.map((row) => (
                  <tr key={row.id} className={cn("border-b border-border/50 hover:bg-muted/40", props.selectedIds.has(row.id) && "bg-accent/40")}>
                    {visible.has("select") ? (
                      <td className="px-2 py-1.5"><input type="checkbox" className="cursor-pointer" checked={props.selectedIds.has(row.id)} onChange={() => props.onToggleSelect(row.id)} /></td>
                    ) : null}
                    {visible.has("code") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link href={`/finance/fiscal-years/${row.id}`} className="cursor-pointer hover:underline">{row.fiscal_year_code}</Link>
                      </td>
                    ) : null}
                    {visible.has("name") ? (
                      <td className="px-2 py-1.5"><Link href={`/finance/fiscal-years/${row.id}`} className="cursor-pointer font-medium hover:underline">{row.fiscal_year_name}</Link></td>
                    ) : null}
                    {visible.has("start") ? <td className="px-2 py-1.5 font-mono text-xs">{row.start_date}</td> : null}
                    {visible.has("end") ? <td className="px-2 py-1.5 font-mono text-xs">{row.end_date}</td> : null}
                    {visible.has("status") ? <td className="px-2 py-1.5"><FinanceStatusBadge status={row.status} /></td> : null}
                    {visible.has("closed") ? <td className="px-2 py-1.5 text-xs">{row.status === "closed" ? "Yes" : "No"}</td> : null}
                    {visible.has("created_by") ? <td className="px-2 py-1.5 text-xs text-muted-foreground">{props.resolveUser?.(row.created_by) ?? "—"}</td> : null}
                    {visible.has("updated") ? <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{row.updated_at?.slice(0, 19) ?? "—"}</td> : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
        <select className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm" value={props.pageSize} onChange={(e) => props.onPageSizeChange(Number(e.target.value))}>
          {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
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
