"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CircleOff,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { CoaEnterpriseTable, type CoaSortKey } from "@/components/finance/coa/coa-enterprise-table";
import { CoaImportPanel } from "@/components/finance/coa/coa-import-panel";
import { CoaTreeView } from "@/components/finance/coa/coa-tree-view";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCoaTablePrefs } from "@/hooks/use-coa-table-prefs";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { isAuthenticated } from "@/lib/auth";
import { ApiClientError } from "@/services/api-client";
import {
  getCoaSummary,
  listAccountGroups,
  listAccounts,
  listAccountTree,
  type AccountGroup,
  type ChartOfAccount,
  type CoaSummary,
} from "@/services/coa-service";

type Tab = "dashboard" | "tree" | "list";

export function CoaHubPage() {
  const { resolve } = useUserDirectory();
  const { prefs, setPrefs } = useCoaTablePrefs();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<CoaSummary | null>(null);
  const [treeRows, setTreeRows] = useState<ChartOfAccount[]>([]);
  const [rows, setRows] = useState<ChartOfAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(prefs.pageSize || 25);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [accountType, setAccountType] = useState("");
  const [groupId, setGroupId] = useState("");
  const [sortBy, setSortBy] = useState<CoaSortKey>("account_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const loadSummary = useCallback(async () => {
    const data = await getCoaSummary();
    setSummary(data);
  }, []);

  const loadTree = useCallback(async () => {
    const data = await listAccountTree({
      q: q || undefined,
      status: status || undefined,
      account_type: accountType || undefined,
      account_group_id: groupId || undefined,
    });
    setTreeRows(data.items);
  }, [q, status, accountType, groupId]);

  const loadList = useCallback(async () => {
    const data = await listAccounts({
      page,
      page_size: pageSize,
      q: q || undefined,
      status: status || undefined,
      account_type: accountType || undefined,
      account_group_id: groupId || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      paged: true,
    });
    setRows(data.items);
    setTotal(data.total);
  }, [page, pageSize, q, status, accountType, groupId, sortBy, sortDir]);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      setError("Sign in to load chart of accounts.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [loadSummary(), listAccountGroups().then(setGroups)];
      if (tab === "tree" || tab === "dashboard") tasks.push(loadTree());
      if (tab === "list" || tab === "dashboard") tasks.push(loadList());
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load COA");
    } finally {
      setLoading(false);
    }
  }, [authenticated, tab, loadSummary, loadTree, loadList]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrefs((p) => ({ ...p, pageSize }));
  }, [pageSize, setPrefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById("coa-search")?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        window.location.href = "/finance/chart-of-accounts/new";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const recent = useMemo(() => summary?.recently_created ?? [], [summary]);

  const onSort = (key: CoaSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="Enterprise COA — hierarchy, balances, and account lifecycle."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5"
              onClick={() => void load()}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Link
              href="/finance/chart-of-accounts/new"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <Plus className="size-3.5" /> New Account
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
        {(
          [
            ["dashboard", "Dashboard"],
            ["tree", "Tree View"],
            ["list", "Account List"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors duration-200 ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <FinanceField label="Search" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              id="coa-search"
              className="h-8"
              value={searchInput}
              placeholder="Code or name… (/)"
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setQ(searchInput.trim());
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => {
                setPage(1);
                setQ(searchInput.trim());
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
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Type">
          <FinanceSelect
            value={accountType}
            onChange={(e) => {
              setPage(1);
              setAccountType(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Income</option>
            <option value="expense">Expense</option>
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Category" className="sm:col-span-2">
          <FinanceSelect
            value={groupId}
            onChange={(e) => {
              setPage(1);
              setGroupId(e.target.value);
            }}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_code} · {g.group_name}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            <FinanceKpiCard label="Total Accounts" value={String(summary?.total_accounts ?? "—")} icon={Landmark} />
            <FinanceKpiCard
              label="Active"
              value={String(summary?.active_accounts ?? "—")}
              icon={Wallet}
              tone="success"
            />
            <FinanceKpiCard
              label="Inactive"
              value={String(summary?.inactive_accounts ?? "—")}
              icon={CircleOff}
              tone="warning"
            />
            <FinanceKpiCard label="Draft" value={String(summary?.draft_accounts ?? "—")} icon={Scale} />
            <FinanceKpiCard label="Assets" value={String(summary?.assets ?? "—")} icon={Building2} tone="success" />
            <FinanceKpiCard label="Liabilities" value={String(summary?.liabilities ?? "—")} icon={Scale} tone="warning" />
            <FinanceKpiCard label="Income" value={String(summary?.income ?? "—")} icon={TrendingUp} />
            <FinanceKpiCard label="Expense" value={String(summary?.expense ?? "—")} icon={TrendingDown} tone="danger" />
            <FinanceKpiCard
              label="Equity"
              value={String(summary?.equity ?? "—")}
              icon={PiggyBank}
              hint="From live COA summary API"
            />
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
            <h3 className="text-sm font-medium tracking-tight">Recently Created Accounts</h3>
            {loading && recent.length === 0 ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted/70" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link
                      href={`/finance/chart-of-accounts/${a.id}`}
                      className="cursor-pointer font-medium hover:underline"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{a.account_code}</span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      {a.account_name}
                    </Link>
                    <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <CoaImportPanel onImported={() => void load()} />
          <CoaTreeView accounts={treeRows} loading={loading} />
        </div>
      ) : null}

      {tab === "tree" ? <CoaTreeView accounts={treeRows} loading={loading} /> : null}

      {tab === "list" ? (
        <CoaEnterpriseTable
          rows={rows}
          loading={loading}
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onToggleSelectAll={(ids) => {
            setSelectedIds((prev) => {
              const allSelected = ids.every((id) => prev.has(id));
              if (allSelected) return new Set();
              return new Set(ids);
            });
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          resolveUser={resolve}
        />
      ) : null}
    </div>
  );
}
