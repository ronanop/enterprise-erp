"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  Landmark,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollPipelineFunnel } from "@/components/payroll/payroll-pipeline-funnel";
import { Badge } from "@/components/ui/badge";
import {
  payrollQuickLinks,
  payrollWorkspaceGroups,
  resolvePayrollGroupResources,
} from "@/config/payroll";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByPaymentStatus,
  countByStatus,
  countOpenDocs,
  formatInr,
  loadPayrollOverview,
  sumField,
  type PayrollOverview,
  type PayrollRow,
} from "@/services/payroll-service";

function recentRuns(rows: PayrollRow[], limit = 6): PayrollRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.run_date ?? b.document_number ?? "").localeCompare(
        String(a.run_date ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function PayrollDashboard() {
  const [data, setData] = useState<PayrollOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadPayrollOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openPeriods: 0,
        openRuns: 0,
        unpaidPayslips: 0,
        netPayTotal: 0,
        activeLoans: 0,
        runNet: 0,
      };
    }
    return {
      openPeriods: countOpenDocs(data.periods, ["closed", "cancelled"]),
      openRuns: countOpenDocs(data.runs, ["posted", "paid", "cancelled"]),
      unpaidPayslips: countByPaymentStatus(data.payslips, ["unpaid", "processing", "failed"]),
      netPayTotal: sumField(data.payslips, "net_salary"),
      activeLoans: countByStatus(data.loans, ["active", "approved"]),
      runNet: sumField(data.runs, "total_net"),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "payroll-periods": data?.periods.length ?? 0,
      "payroll-runs": data?.runs.length ?? 0,
      payslips: data?.payslips.length ?? 0,
      bonuses: data?.bonuses.length ?? 0,
      loans: data?.loans.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentRuns(data?.runs ?? []), [data]);

  const payslipWatch = useMemo(() => {
    const rows = data?.payslips ?? [];
    return [...rows]
      .sort((a, b) => asNumber(b.net_salary) - asNumber(a.net_salary))
      .slice(0, 5);
  }, [data]);

  const runStatusMix = useMemo(() => {
    const rows = data?.runs ?? [];
    const stages = [
      { key: "draft", label: "Draft", barClass: "bg-slate-400" },
      { key: "calculated", label: "Calculated", barClass: "bg-sky-600" },
      { key: "submitted", label: "Submitted", barClass: "bg-amber-500" },
      { key: "approved", label: "Approved", barClass: "bg-teal-600" },
      { key: "posted", label: "Posted", barClass: "bg-emerald-600" },
      { key: "paid", label: "Paid", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStatus(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Compensation workspace — periods, salary structures, payroll runs, payslips, bonuses, loans, and statutory."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/payroll/payroll-runs"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Landmark className="size-3.5" />
              Runs
            </Link>
            <Link
              href="/payroll/payslips"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Payslips
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live payroll data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some payroll endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open periods"
          value={loading ? "—" : String(kpis.openPeriods)}
          hint={`${data?.periods.length ?? 0} periods · ${countByStatus(data?.periods ?? [], ["processing"])} processing`}
          icon={CalendarRange}
          tone={kpis.openPeriods > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open payroll runs"
          value={loading ? "—" : String(kpis.openRuns)}
          hint={`${formatInr(kpis.runNet)} net · ${data?.runs.length ?? 0} runs`}
          icon={Landmark}
          tone={kpis.openRuns > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Unpaid payslips"
          value={loading ? "—" : String(kpis.unpaidPayslips)}
          hint={`${formatInr(kpis.netPayTotal)} net salary · ${data?.payslips.length ?? 0} slips`}
          icon={Receipt}
          tone={kpis.unpaidPayslips > 0 ? "danger" : "success"}
        />
        <FinanceKpiCard
          label="Active loans"
          value={loading ? "—" : String(kpis.activeLoans)}
          hint={`${data?.loans.length ?? 0} loans · ${countByStatus(data?.bonuses ?? [], ["submitted", "approved"])} bonuses pending`}
          icon={Wallet}
          tone={kpis.activeLoans > 0 ? "default" : "success"}
        />
      </div>

      <PayrollPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {payrollQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{payrollWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {payrollWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolvePayrollGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/payroll/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent payroll runs</h2>
              <p className="text-[11px] text-muted-foreground">Processing book</p>
            </div>
            <Link
              href="/payroll/payroll-runs"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Run</th>
                  <th className="px-4 py-2.5 font-medium">Employees</th>
                  <th className="px-4 py-2.5 font-medium">Net</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No payroll runs yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[180px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.document_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.run_date ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {asNumber(row.employee_count)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatInr(asNumber(row.total_net))}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Payslip watch</h2>
              <p className="text-[11px] text-muted-foreground">Highest net salary</p>
            </div>
            <Link
              href="/payroll/payslips"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : payslipWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No payslips yet.
              </li>
            ) : (
              payslipWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.employee_name ?? row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={String(row.payment_status ?? row.status ?? "generated")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.document_number ?? "")} · Net{" "}
                    {formatInr(asNumber(row.net_salary))}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Run status mix</h2>
            <p className="text-[11px] text-muted-foreground">Payroll run pipeline</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {runStatusMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Active salaries {countByStatus(data?.employeeSalaries ?? [], ["active"])} · Structures{" "}
                {countByStatus(data?.structures ?? [], ["active"])} · Reimbursements{" "}
                {countOpenDocs(data?.reimbursements ?? [], ["paid", "cancelled", "rejected"])}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
