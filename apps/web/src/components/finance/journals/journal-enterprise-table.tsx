"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  FileSpreadsheet,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJournalTablePrefs } from "@/hooks/use-journal-table-prefs";
import {
  exportJournalsCsv,
  exportJournalsXlsx,
} from "@/lib/finance/journal-export";
import { cn } from "@/lib/utils";
import { formatInrPrecise } from "@/services/finance-service";
import type { Journal } from "@/services/journal-service";
import { journalDifference } from "@/services/journal-service";

export type JournalSortKey =
  | "journal_number"
  | "journal_date"
  | "journal_type"
  | "status"
  | "total_debit"
  | "total_credit"
  | "posted_at"
  | "created_at";

type ColumnKey =
  | "select"
  | "voucher"
  | "date"
  | "type"
  | "period"
  | "status"
  | "workflow"
  | "debit"
  | "credit"
  | "diff"
  | "created_by"
  | "posted_by"
  | "posted_at";

const COLUMN_LABELS: Record<Exclude<ColumnKey, "select">, string> = {
  voucher: "Voucher No",
  date: "Date",
  type: "Journal Type",
  period: "Period",
  status: "Status",
  workflow: "Workflow",
  debit: "Debit Total",
  credit: "Credit Total",
  diff: "Difference",
  created_by: "Created By",
  posted_by: "Posted By",
  posted_at: "Posted Date",
};

type PeriodMap = Record<string, string>;

type JournalEnterpriseTableProps = {
  rows: Journal[];
  loading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  sortBy: JournalSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: JournalSortKey) => void;
  periodLabels: PeriodMap;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  resolveUser?: (id?: string | null) => string;
};

function shortId(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 8);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return value;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 19).replace("T", " ");
  return d.toLocaleString("en-IN");
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

export function JournalEnterpriseTable({
  rows,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  sortBy,
  sortDir,
  onSort,
  periodLabels,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  resolveUser = (id) => (id ? id.slice(0, 8) : "—"),
}: JournalEnterpriseTableProps) {
  const { prefs, setPrefs } = useJournalTablePrefs();
  const [showCols, setShowCols] = useState(false);
  const [colWidths, setColWidths] = useState<Partial<Record<ColumnKey, number>>>({});
  const resizing = useRef<{ key: ColumnKey; startX: number; startW: number } | null>(
    null,
  );

  useEffect(() => {
    if (prefs.pageSize !== pageSize) {
      onPageSizeChange(prefs.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.pageSize]);

  const visible = useMemo(
    () => new Set(prefs.visibleColumns as ColumnKey[]),
    [prefs.visibleColumns],
  );

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.total_debit || 0), 0);
    const credit = rows.reduce((s, r) => s + Number(r.total_credit || 0), 0);
    return { debit, credit, diff: debit - credit };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function isVisible(key: ColumnKey) {
    return visible.has(key);
  }

  function toggleCol(key: ColumnKey) {
    setPrefs((prev) => {
      const set = new Set(prev.visibleColumns);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, visibleColumns: Array.from(set) };
    });
  }

  function onResizeStart(key: ColumnKey, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[key] ?? 140;
    resizing.current = { key, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      setColWidths((w) => ({
        ...w,
        [resizing.current!.key]: Math.max(80, resizing.current!.startW + delta),
      }));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function headerButton(key: JournalSortKey, label: string) {
    return (
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 font-medium tracking-wide uppercase transition-colors duration-200 hover:text-foreground"
        onClick={() => onSort(key)}
      >
        {label}
        <SortIcon active={sortBy === key} dir={sortDir} />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => exportJournalsCsv(rows, periodLabels, resolveUser)}
            disabled={rows.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => exportJournalsXlsx(rows, periodLabels, resolveUser)}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet className="size-3.5" />
            Export Excel
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setShowCols((v) => !v)}
            >
              <Columns3 className="size-3.5" />
              Columns
            </Button>
            {showCols ? (
              <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-border/80 bg-card p-2 shadow-md">
                {(Object.keys(COLUMN_LABELS) as Exclude<ColumnKey, "select">[]).map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible(key)}
                      onChange={() => toggleCol(key)}
                      className="cursor-pointer"
                    />
                    {COLUMN_LABELS[key]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          {selectedIds.size > 0 ? (
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {total} journal{total === 1 ? "" : "s"} · page {page} / {totalPages}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="erp-scroll max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {isVisible("select") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={allSelected}
                      onChange={() => onToggleSelectAll(pageIds)}
                      aria-label="Select all on page"
                    />
                  </th>
                ) : null}
                {isVisible("voucher") ? (
                  <th
                    className="relative border-b border-border/70 px-3 py-2.5"
                    style={{
                      width: colWidths.voucher,
                      minWidth: 120,
                    }}
                  >
                    {headerButton("journal_number", "Voucher No")}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
                      onMouseDown={(e) => onResizeStart("voucher", e)}
                    />
                  </th>
                ) : null}
                {isVisible("date") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">
                    {headerButton("journal_date", "Date")}
                  </th>
                ) : null}
                {isVisible("type") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">
                    {headerButton("journal_type", "Type")}
                  </th>
                ) : null}
                {isVisible("period") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">Period</th>
                ) : null}
                {isVisible("status") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">
                    {headerButton("status", "Status")}
                  </th>
                ) : null}
                {isVisible("workflow") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">Workflow</th>
                ) : null}
                {isVisible("debit") ? (
                  <th className="border-b border-border/70 px-3 py-2.5 text-right">
                    {headerButton("total_debit", "Debit")}
                  </th>
                ) : null}
                {isVisible("credit") ? (
                  <th className="border-b border-border/70 px-3 py-2.5 text-right">
                    {headerButton("total_credit", "Credit")}
                  </th>
                ) : null}
                {isVisible("diff") ? (
                  <th className="border-b border-border/70 px-3 py-2.5 text-right">Diff</th>
                ) : null}
                {isVisible("created_by") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">Created By</th>
                ) : null}
                {isVisible("posted_by") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">Posted By</th>
                ) : null}
                {isVisible("posted_at") ? (
                  <th className="border-b border-border/70 px-3 py-2.5">
                    {headerButton("posted_at", "Posted Date")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-6">
                      <div className="space-y-2 animate-pulse">
                        <div className="h-8 rounded bg-muted" />
                        <div className="h-8 rounded bg-muted/70" />
                        <div className="h-8 rounded bg-muted/50" />
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No journals match the current filters.
                      <div className="mt-2">
                        <Link
                          href="/finance/journals/new"
                          className="cursor-pointer text-xs font-medium text-primary underline"
                        >
                          Create a journal
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                rows.map((row) => {
                  const diff = journalDifference(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      {isVisible("select") ? (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selectedIds.has(row.id)}
                            onChange={() => onToggleSelect(row.id)}
                            aria-label={`Select ${row.journal_number}`}
                          />
                        </td>
                      ) : null}
                      {isVisible("voucher") ? (
                        <td className="px-3 py-2">
                          <Link
                            href={`/finance/journals/${row.id}`}
                            className="cursor-pointer font-medium text-primary transition-opacity duration-200 hover:opacity-80"
                          >
                            {row.journal_number}
                          </Link>
                        </td>
                      ) : null}
                      {isVisible("date") ? (
                        <td className="px-3 py-2 font-mono text-xs tabular-nums">
                          {formatDate(row.journal_date)}
                        </td>
                      ) : null}
                      {isVisible("type") ? (
                        <td className="px-3 py-2 capitalize">{row.journal_type}</td>
                      ) : null}
                      {isVisible("period") ? (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.period_id
                            ? periodLabels[row.period_id] ?? shortId(row.period_id)
                            : "—"}
                        </td>
                      ) : null}
                      {isVisible("status") ? (
                        <td className="px-3 py-2">
                          <FinanceStatusBadge status={row.status} />
                        </td>
                      ) : null}
                      {isVisible("workflow") ? (
                        <td className="px-3 py-2">
                          <FinanceStatusBadge status={row.workflow_status} />
                        </td>
                      ) : null}
                      {isVisible("debit") ? (
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {formatInrPrecise(row.total_debit)}
                        </td>
                      ) : null}
                      {isVisible("credit") ? (
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {formatInrPrecise(row.total_credit)}
                        </td>
                      ) : null}
                      {isVisible("diff") ? (
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-mono text-xs tabular-nums",
                            Math.abs(diff) > 0.0001
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatInrPrecise(diff)}
                        </td>
                      ) : null}
                      {isVisible("created_by") ? (
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {resolveUser(row.created_by)}
                        </td>
                      ) : null}
                      {isVisible("posted_by") ? (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {resolveUser(row.posted_by)}
                        </td>
                      ) : null}
                      {isVisible("posted_at") ? (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatDateTime(row.posted_at)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="text-xs font-medium">
                <td
                  className="border-t border-border/70 px-3 py-2.5"
                  colSpan={
                    [
                      isVisible("select"),
                      isVisible("voucher"),
                      isVisible("date"),
                      isVisible("type"),
                      isVisible("period"),
                      isVisible("status"),
                      isVisible("workflow"),
                    ].filter(Boolean).length || 1
                  }
                >
                  Page totals
                </td>
                {isVisible("debit") ? (
                  <td className="border-t border-border/70 px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(totals.debit)}
                  </td>
                ) : null}
                {isVisible("credit") ? (
                  <td className="border-t border-border/70 px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(totals.credit)}
                  </td>
                ) : null}
                {isVisible("diff") ? (
                  <td className="border-t border-border/70 px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatInrPrecise(totals.diff)}
                  </td>
                ) : null}
                {(isVisible("created_by") ||
                  isVisible("posted_by") ||
                  isVisible("posted_at")) && (
                  <td
                    className="border-t border-border/70 px-3 py-2.5"
                    colSpan={
                      [
                        isVisible("created_by"),
                        isVisible("posted_by"),
                        isVisible("posted_at"),
                      ].filter(Boolean).length
                    }
                  />
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows</span>
          <select
            className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm"
            value={pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setPrefs((p) => ({ ...p, pageSize: size }));
              onPageSizeChange(size);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Input
            className="h-8 w-14 text-center"
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 1 && n <= totalPages) onPageChange(n);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
