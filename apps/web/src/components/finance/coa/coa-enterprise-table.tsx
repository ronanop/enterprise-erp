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
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { useCoaTablePrefs } from "@/hooks/use-coa-table-prefs";
import { exportCoaCsv, exportCoaXlsx } from "@/lib/finance/coa-export";
import { cn } from "@/lib/utils";
import { formatInrPrecise } from "@/services/finance-service";
import {
  accountTypeLabel,
  type ChartOfAccount,
} from "@/services/coa-service";

export type CoaSortKey =
  | "account_code"
  | "account_name"
  | "account_type"
  | "status"
  | "created_at"
  | "currency_code";

type ColumnKey =
  | "select"
  | "code"
  | "name"
  | "parent"
  | "type"
  | "category"
  | "currency"
  | "status"
  | "posting"
  | "balance"
  | "created_by";

const COLUMN_LABELS: Record<Exclude<ColumnKey, "select">, string> = {
  code: "Account Code",
  name: "Account Name",
  parent: "Parent",
  type: "Account Type",
  category: "Category",
  currency: "Currency",
  status: "Status",
  posting: "Allow Posting",
  balance: "Balance",
  created_by: "Created By",
};

type Props = {
  rows: ChartOfAccount[];
  loading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  sortBy: CoaSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: CoaSortKey) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  resolveUser?: (id?: string | null) => string;
};

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

export function CoaEnterpriseTable({
  rows,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  sortBy,
  sortDir,
  onSort,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  resolveUser = (id) => (id ? id.slice(0, 8) : "—"),
}: Props) {
  const { prefs, setPrefs } = useCoaTablePrefs();
  const [colsOpen, setColsOpen] = useState(false);

  const visible = useMemo(() => new Set(prefs.visibleColumns), [prefs.visibleColumns]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const exportRows = rows.filter((r) => selectedIds.size === 0 || selectedIds.has(r.id));

  const sortable: Partial<Record<ColumnKey, CoaSortKey>> = {
    code: "account_code",
    name: "account_name",
    type: "account_type",
    status: "status",
    currency: "currency_code",
    created_by: "created_at",
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          onClick={() => exportCoaCsv(exportRows, resolveUser)}
        >
          <Download className="size-3.5" /> CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer gap-1.5"
          onClick={() => exportCoaXlsx(exportRows, resolveUser)}
        >
          <FileSpreadsheet className="size-3.5" /> XLSX
        </Button>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer gap-1.5"
            onClick={() => setColsOpen((v) => !v)}
          >
            <Columns3 className="size-3.5" /> Columns
          </Button>
          {colsOpen ? (
            <div className="absolute top-9 left-0 z-20 w-52 rounded-lg border border-border bg-card p-2 shadow-md">
              {(Object.keys(COLUMN_LABELS) as Array<Exclude<ColumnKey, "select">>).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                >
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
                  {COLUMN_LABELS[key]}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected · ` : ""}
          {total} total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {visible.has("select") ? (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll(allIds)}
                    aria-label="Select all"
                  />
                </th>
              ) : null}
              {(Object.keys(COLUMN_LABELS) as Array<Exclude<ColumnKey, "select">>).map((key) => {
                if (!visible.has(key)) return null;
                const sortKey = sortable[key];
                return (
                  <th key={key} className="px-2 py-2 whitespace-nowrap">
                    {sortKey ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
                        onClick={() => onSort(sortKey)}
                      >
                        {COLUMN_LABELS[key]}
                        <SortIcon active={sortBy === sortKey} dir={sortDir} />
                      </button>
                    ) : (
                      COLUMN_LABELS[key]
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={12} className="px-2 py-2">
                      <div className="h-6 animate-pulse rounded bg-muted/70" />
                    </td>
                  </tr>
                ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No accounts found. Adjust filters or create a new account.
                </td>
              </tr>
            ) : null}
            {!loading
              ? rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/50 transition-colors duration-150 hover:bg-muted/40",
                      selectedIds.has(row.id) && "bg-accent/40",
                    )}
                  >
                    {visible.has("select") ? (
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          checked={selectedIds.has(row.id)}
                          onChange={() => onToggleSelect(row.id)}
                        />
                      </td>
                    ) : null}
                    {visible.has("code") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link
                          href={`/finance/chart-of-accounts/${row.id}`}
                          className="cursor-pointer text-foreground hover:underline"
                        >
                          {row.account_code}
                        </Link>
                      </td>
                    ) : null}
                    {visible.has("name") ? (
                      <td className="px-2 py-1.5">
                        <Link
                          href={`/finance/chart-of-accounts/${row.id}`}
                          className="cursor-pointer font-medium hover:underline"
                        >
                          {row.account_name}
                        </Link>
                      </td>
                    ) : null}
                    {visible.has("parent") ? (
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {row.parent_account_code
                          ? `${row.parent_account_code} · ${row.parent_account_name ?? ""}`
                          : "—"}
                      </td>
                    ) : null}
                    {visible.has("type") ? (
                      <td className="px-2 py-1.5 text-xs capitalize">
                        {accountTypeLabel(row.account_type)}
                      </td>
                    ) : null}
                    {visible.has("category") ? (
                      <td className="px-2 py-1.5 text-xs">
                        {row.account_group_name ?? row.account_group_code ?? "—"}
                      </td>
                    ) : null}
                    {visible.has("currency") ? (
                      <td className="px-2 py-1.5 font-mono text-xs">{row.currency_code ?? "—"}</td>
                    ) : null}
                    {visible.has("status") ? (
                      <td className="px-2 py-1.5">
                        <FinanceStatusBadge status={row.status} />
                      </td>
                    ) : null}
                    {visible.has("posting") ? (
                      <td className="px-2 py-1.5 text-xs">{row.is_posting_account ? "Yes" : "No"}</td>
                    ) : null}
                    {visible.has("balance") ? (
                      <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                        {formatInrPrecise(row.balance ?? 0)}
                      </td>
                    ) : null}
                    {visible.has("created_by") ? (
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {resolveUser(row.created_by)}
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows</span>
          <select
            className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
            className="h-8 cursor-pointer"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
