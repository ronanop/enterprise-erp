"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, RotateCcw } from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportFilters } from "@/hooks/use-report-filters";
import { resourceService } from "@/services/api-client";

type Option = { id: string; label: string };

export type ReportFilterField =
  | "fiscalYear"
  | "period"
  | "fromDate"
  | "toDate"
  | "asOf"
  | "account"
  | "costCenter"
  | "currency"
  | "status"
  | "search";

type Props = {
  filters: ReportFilters;
  onChange: (patch: Partial<ReportFilters>) => void;
  onReset?: () => void;
  onSaveBookmark?: (name: string) => void;
  bookmarks?: { id: string; name: string }[];
  onApplyBookmark?: (id: string) => void;
  fields?: ReportFilterField[];
  className?: string;
};

const DEFAULT_FIELDS: ReportFilterField[] = [
  "fiscalYear",
  "period",
  "fromDate",
  "toDate",
  "account",
  "costCenter",
];

export function ReportFiltersBar({
  filters,
  onChange,
  onReset,
  onSaveBookmark,
  bookmarks = [],
  onApplyBookmark,
  fields = DEFAULT_FIELDS,
}: Props) {
  const [fiscalYears, setFiscalYears] = useState<Option[]>([]);
  const [periods, setPeriods] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [costCenters, setCostCenters] = useState<Option[]>([]);
  const [bookmarkName, setBookmarkName] = useState("");

  const loadLookups = useCallback(async () => {
    const needsAccounts = fields.includes("account");
    const needsCostCenters = fields.includes("costCenter");
    const needsFiscal = fields.includes("fiscalYear") || fields.includes("period");

    const tasks: Promise<void>[] = [];
    if (needsFiscal) {
      tasks.push(
        resourceService.list("/finance/fiscal-years").then((res) => {
          const list = Array.isArray(res.data)
            ? res.data
            : ((res.data as { items?: unknown[] })?.items ?? []);
          setFiscalYears(
            list.map((row) => {
              const r = row as Record<string, unknown>;
              return { id: String(r.id), label: String(r.fiscal_year_code ?? r.id) };
            }),
          );
        }),
        resourceService.list("/finance/periods").then((res) => {
          const list = Array.isArray(res.data)
            ? res.data
            : ((res.data as { items?: unknown[] })?.items ?? []);
          setPeriods(
            list.map((row) => {
              const r = row as Record<string, unknown>;
              return { id: String(r.id), label: String(r.period_name ?? r.period_number ?? r.id) };
            }),
          );
        }),
      );
    }
    if (needsAccounts) {
      tasks.push(
        resourceService.list("/finance/chart-of-accounts").then((res) => {
          const list = Array.isArray(res.data)
            ? res.data
            : ((res.data as { items?: unknown[] })?.items ?? []);
          setAccounts(
            list.map((row) => {
              const r = row as Record<string, unknown>;
              return {
                id: String(r.id),
                label: `${r.account_code} · ${r.account_name}`,
              };
            }),
          );
        }),
      );
    }
    if (needsCostCenters) {
      tasks.push(
        resourceService.list("/cost-centers").then((res) => {
          const list = Array.isArray(res.data)
            ? res.data
            : ((res.data as { items?: unknown[] })?.items ?? []);
          setCostCenters(
            list.map((row) => {
              const r = row as Record<string, unknown>;
              return {
                id: String(r.id),
                label: String(r.cost_center_name ?? r.name ?? r.code ?? r.id),
              };
            }),
          );
        }),
      );
    }
    await Promise.allSettled(tasks);
  }, [fields]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const show = (f: ReportFilterField) => fields.includes(f);

  return (
    <div className="sticky top-0 z-20 space-y-2 rounded-xl border border-border/80 bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {show("fiscalYear") ? (
          <FinanceField label="Fiscal Year">
            <FinanceSelect
              value={filters.fiscalYearId}
              onChange={(e) => onChange({ fiscalYearId: e.target.value })}
            >
              <option value="">All</option>
              {fiscalYears.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {show("period") ? (
          <FinanceField label="Period">
            <FinanceSelect
              value={filters.periodId}
              onChange={(e) => onChange({ periodId: e.target.value })}
            >
              <option value="">All</option>
              {periods.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {show("fromDate") ? (
          <FinanceField label="From">
            <Input
              type="date"
              className="h-8 font-mono"
              value={filters.fromDate}
              onChange={(e) => onChange({ fromDate: e.target.value })}
            />
          </FinanceField>
        ) : null}

        {show("toDate") ? (
          <FinanceField label="To">
            <Input
              type="date"
              className="h-8 font-mono"
              value={filters.toDate}
              onChange={(e) => onChange({ toDate: e.target.value })}
            />
          </FinanceField>
        ) : null}

        {show("asOf") ? (
          <FinanceField label="As of">
            <Input
              type="date"
              className="h-8 font-mono"
              value={filters.asOf}
              onChange={(e) => onChange({ asOf: e.target.value })}
            />
          </FinanceField>
        ) : null}

        {show("account") ? (
          <FinanceField label="Account" className="sm:col-span-2">
            <FinanceSelect
              value={filters.accountId}
              onChange={(e) => onChange({ accountId: e.target.value })}
            >
              <option value="">All accounts</option>
              {accounts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {show("costCenter") ? (
          <FinanceField label="Cost Center">
            <FinanceSelect
              value={filters.costCenterId}
              onChange={(e) => onChange({ costCenterId: e.target.value })}
            >
              <option value="">All</option>
              {costCenters.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {show("currency") ? (
          <FinanceField label="Currency">
            <Input
              className="h-8 font-mono uppercase"
              maxLength={3}
              value={filters.currency}
              placeholder="INR"
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
            />
          </FinanceField>
        ) : null}

        {show("status") ? (
          <FinanceField label="Status">
            <FinanceSelect
              value={filters.status}
              onChange={(e) => onChange({ status: e.target.value })}
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
              <option value="cancelled">Cancelled</option>
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {show("search") ? (
          <FinanceField label="Search" className="sm:col-span-2">
            <Input
              className="h-8"
              value={filters.q}
              placeholder="Reference, voucher, description…"
              onChange={(e) => onChange({ q: e.target.value })}
            />
          </FinanceField>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
        {onReset ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer gap-1.5"
            onClick={onReset}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        ) : null}

        {onSaveBookmark ? (
          <>
            <Input
              className="h-8 w-40"
              placeholder="Bookmark name"
              value={bookmarkName}
              onChange={(e) => setBookmarkName(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5"
              onClick={() => {
                onSaveBookmark(bookmarkName);
                setBookmarkName("");
              }}
            >
              <BookmarkPlus className="size-3.5" /> Save filter
            </Button>
          </>
        ) : null}

        {bookmarks.length > 0 && onApplyBookmark ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Bookmark className="size-3.5 text-muted-foreground" />
            {bookmarks.slice(0, 5).map((bm) => (
              <button
                key={bm.id}
                type="button"
                className="cursor-pointer rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs transition-colors duration-200 hover:bg-muted"
                onClick={() => onApplyBookmark(bm.id)}
              >
                {bm.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
