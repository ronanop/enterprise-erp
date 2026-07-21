"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import {
  JournalEnterpriseTable,
  type JournalSortKey,
} from "@/components/finance/journals/journal-enterprise-table";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { ApiClientError, resourceService } from "@/services/api-client";
import { listJournals, type Journal } from "@/services/journal-service";

type Option = { id: string; label: string };

export function JournalListPage() {
  const { resolve } = useUserDirectory();
  const [rows, setRows] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [journalType, setJournalType] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [sortBy, setSortBy] = useState<JournalSortKey>("journal_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [periods, setPeriods] = useState<Option[]>([]);

  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const periodLabels = useMemo(
    () => Object.fromEntries(periods.map((p) => [p.id, p.label])),
    [periods],
  );

  const loadLookups = useCallback(async () => {
    try {
      const res = await resourceService.list("/finance/periods");
      const data = res.data;
      const list = Array.isArray(data) ? data : [];
      setPeriods(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            label: String(r.period_name ?? r.period_number ?? r.id),
          };
        }),
      );
    } catch {
      setPeriods([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listJournals({
        page,
        page_size: pageSize,
        q: q || undefined,
        status: status || undefined,
        journal_type: journalType || undefined,
        period_id: periodId || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof ApiClientError ? err.message : "Failed to load journals");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, status, journalType, periodId, sortBy, sortDir]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSort(key: JournalSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journals"
        description="Enterprise journal vouchers — search, filter, post, and reverse via live Finance APIs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/finance/journals/new"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Plus className="size-3.5" />
              Create Journal
            </Link>
          </div>
        }
      />

      {!authenticated ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load journals.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
        <FinanceField label="Search" className="xl:col-span-2">
          <div className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Voucher no or description…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQ(searchInput.trim());
                  setPage(1);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setQ(searchInput.trim());
                setPage(1);
              }}
            >
              Search
            </Button>
          </div>
        </FinanceField>
        <FinanceField label="Status">
          <FinanceSelect
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {["draft", "submitted", "approved", "posted", "reversed", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Journal Type">
          <FinanceSelect
            value={journalType}
            onChange={(e) => {
              setJournalType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {["manual", "system", "adjustment", "reversal"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Period">
          <FinanceSelect
            value={periodId}
            onChange={(e) => {
              setPeriodId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
      </div>

      <JournalEnterpriseTable
        rows={rows}
        loading={loading}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        periodLabels={periodLabels}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        resolveUser={resolve}
      />
    </div>
  );
}
