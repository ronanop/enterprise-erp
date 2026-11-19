"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Lock,
  Plus,
  Unlock,
  Upload,
} from "lucide-react";

import {
  AssignSalaryDrawer,
  AdjustmentDrawer,
  BonusDrawer,
  LoanDrawer,
  LockMonthDrawer,
  ReimbDrawer,
  RevisionDrawer,
  RunPayrollDrawer,
  StructureDrawer,
} from "@/components/hr/payroll/payroll-drawers";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  addBonus,
  addPayrollAdjustment,
  addLoan,
  addReimbursement,
  advancePayrollApproval,
  approveReimbursement,
  assignEmployeeSalary,
  computePayrollStats,
  createRevision,
  createStructure,
  downloadTextFile,
  exportPayslipText,
  exportRunsCsv,
  filterRuns,
  formatInr,
  generatePayslips,
  importStructuresCsv,
  listPayrollAudit,
  loadPayrollDirectory,
  lockPayrollMonth,
  resetStructuresToCacheDigitech,
  runPayroll,
  unlockPayrollMonth,
  updateStructure,
  type PayrollDirectory,
} from "@/services/payroll-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import type { PayslipRecord, SalaryStructure } from "@/types/payroll-management";
import {
  emptyPayrollFilters,
  RUN_STATUS_LABELS,
  structureDeductions as dedOf,
  structureGross as grossOf,
} from "@/types/payroll-management";

const PAGE = 10;

type Tab =
  | "dashboard"
  | "structures"
  | "employees"
  | "process"
  | "approvals"
  | "locks"
  | "revisions"
  | "bonuses"
  | "reimbursements"
  | "loans"
  | "payslips"
  | "reports"
  | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "structures", label: "Salary Structures" },
  { id: "employees", label: "Employee Salary" },
  { id: "process", label: "Monthly Process" },
  { id: "approvals", label: "Approvals" },
  { id: "locks", label: "Month Lock" },
  { id: "revisions", label: "Revisions" },
  { id: "bonuses", label: "Bonuses" },
  { id: "reimbursements", label: "Reimbursements" },
  { id: "loans", label: "Loans" },
  { id: "payslips", label: "Payslips" },
  { id: "reports", label: "Reports" },
  { id: "audit", label: "Audit" },
];

function ApprovalTimeline({ status }: { status: string }) {
  const steps = [
    { key: "exec", label: "Payroll Exec", done: true },
    {
      key: "hr",
      label: "HR Manager",
      done: ["pending_finance", "approved", "paid", "locked"].includes(status),
      active: status === "pending_hr",
    },
    {
      key: "fin",
      label: "Finance",
      done: ["approved", "paid", "locked"].includes(status),
      active: status === "pending_finance",
    },
    {
      key: "ok",
      label: "Approved",
      done: ["approved", "paid", "locked"].includes(status),
      active: status === "approved" || status === "paid",
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              s.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : s.active
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-border bg-muted text-muted-foreground",
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-[10px] text-muted-foreground">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PayrollManagementPage() {
  const [dir, setDir] = useState<PayrollDirectory | null>(null);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState(() => emptyPayrollFilters());
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<PayslipRecord | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [structureOpen, setStructureOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [reimbOpen, setReimbOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pay, master] = await Promise.all([
        loadPayrollDirectory(),
        loadHrMasterDirectory().catch(() => null),
      ]);
      setDir(pay);
      setEmployees(master?.employees ?? []);
    } catch {
      toast("Failed to load payroll data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setPage(1), [filters, tab]);

  const stats = useMemo(() => (dir ? computePayrollStats(dir) : null), [dir]);
  const runs = useMemo(() => filterRuns(dir?.runs ?? [], filters), [dir, filters]);
  const pageRuns = useMemo(() => {
    const s = (page - 1) * PAGE;
    return runs.slice(s, s + PAGE);
  }, [runs, page]);
  const audit = useMemo(() => listPayrollAudit(), [dir, tab]);
  const authBlocked =
    !isAuthenticated() &&
    !loading &&
    !(dir?.structures.length || dir?.runs.length || dir?.salaries.length);

  const maxNet = Math.max(1, ...(dir?.runs.map((r) => r.netTotal) ?? [1]));

  function refresh() {
    void load();
  }

  async function handleGeneratePayslips() {
    const run =
      dir?.runs.find((r) => ["approved", "paid", "pending_finance", "pending_hr"].includes(r.status)) ??
      dir?.runs[0];
    if (!run) {
      toast("Run payroll first", "error");
      return;
    }
    try {
      const slips = await generatePayslips(run.id);
      toast(`Generated ${slips.length} payslips`);
      refresh();
      setTab("payslips");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Payroll Management"
        description="Manage salary structures, monthly payroll processing, payslips, statutory deductions, and payroll approvals."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setRunOpen(true)}>
              <Plus className="size-3.5" />
              Run Payroll
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setEditingStructure(null);
                setStructureOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Salary Structure
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setRevisionOpen(true)}
            >
              <Plus className="size-3.5" />
              Add Salary Revision
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={handleGeneratePayslips}
            >
              <FileText className="size-3.5" />
              Generate Payslips
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `payroll-runs-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportRunsCsv(dir?.runs ?? []),
                  "text/csv",
                );
                toast("Exported CSV");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Total Employees", value: stats?.totalEmployees ?? 0 },
          { label: "Payroll Processed", value: stats?.payrollProcessed ?? 0 },
          { label: "Pending Payroll", value: stats?.pendingPayroll ?? 0 },
          { label: "Locked Payroll Months", value: stats?.lockedMonths ?? 0 },
          {
            label: "Net Salary Paid",
            value: formatInr(stats?.netSalaryPaid ?? 0),
            money: true,
          },
          { label: "Pending Approvals", value: stats?.pendingApprovals ?? 0 },
          { label: "Upcoming Salary Revision", value: stats?.upcomingRevisions ?? 0 },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {k.label}
            </p>
            <p className={cn("mt-1 font-semibold tabular-nums text-foreground", k.money ? "text-sm" : "text-xl")}>
              {loading ? "—" : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border/60 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "cursor-pointer rounded-t-md px-3 py-2 text-xs font-medium transition-colors duration-200",
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !dir ? (
        <EmsSkeleton rows={6} />
      ) : (
        <>
          {tab === "dashboard" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Net salary by run</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Recent payroll cycles</p>
                <div className="mt-4 space-y-2">
                  {(dir?.runs.slice(0, 6) ?? []).length === 0 ? (
                    <HrEmptyState
                      title="No payroll runs yet"
                      description="Click Run Payroll to process a month."
                      action={
                        <Button size="sm" className="cursor-pointer" onClick={() => setRunOpen(true)}>
                          Run Payroll
                        </Button>
                      }
                    />
                  ) : (
                    dir?.runs.slice(0, 6).map((r) => (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{r.monthLabel}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatInr(r.netTotal)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80 transition-all duration-300"
                            style={{ width: `${Math.max(6, (r.netTotal / maxNet) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Pending approvals</h3>
                <div className="mt-3 space-y-3">
                  {(dir?.runs.filter((r) =>
                    ["pending_hr", "pending_finance"].includes(r.status),
                  ) ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pending approvals.</p>
                  ) : (
                    dir?.runs
                      .filter((r) => ["pending_hr", "pending_finance"].includes(r.status))
                      .slice(0, 5)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {r.runCode} · {r.monthLabel}
                            </p>
                            <ApprovalTimeline status={r.status} />
                          </div>
                          <Button
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => {
                              try {
                                advancePayrollApproval(r.id);
                                toast("Advanced approval");
                                refresh();
                              } catch (e) {
                                toast(e instanceof Error ? e.message : "Failed", "error");
                              }
                            }}
                          >
                            Approve
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "structures" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingStructure(null);
                    setStructureOpen(true);
                  }}
                >
                  <Plus className="size-3.5" />
                  Create Salary Structure
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    resetStructuresToCacheDigitech();
                    toast("Loaded Cache Digitech salary structures");
                    refresh();
                  }}
                >
                  Load Cache Digitech Templates
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Import CSV
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    const n = importStructuresCsv(text);
                    toast(`Imported ${n} structures`);
                    refresh();
                    e.target.value = "";
                  }}
                />
              </div>
              {(dir?.structures.length ?? 0) === 0 ? (
                <HrEmptyState title="No salary structures" description="Create a CTC template." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Structure</th>
                        <th className="px-3 py-2 font-medium">Basic</th>
                        <th className="px-3 py-2 font-medium">HRA</th>
                        <th className="px-3 py-2 font-medium">Gross</th>
                        <th className="px-3 py-2 font-medium">Deductions</th>
                        <th className="px-3 py-2 font-medium">Net</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.structures.map((s) => {
                        const g = grossOf(s);
                        const d = dedOf(s);
                        return (
                          <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{s.name}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(s.basic)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(s.hra)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(g)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(d)}</td>
                            <td className="px-3 py-2 tabular-nums font-medium">
                              {formatInr(g - d)}
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 cursor-pointer"
                                onClick={() => {
                                  setEditingStructure(s);
                                  setStructureOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "employees" ? (
            <section className="space-y-3">
              <Button size="sm" className="cursor-pointer" onClick={() => setAssignOpen(true)}>
                <Plus className="size-3.5" />
                Assign Salary
              </Button>
              {(dir?.salaries.length ?? 0) === 0 ? (
                <HrEmptyState
                  title="No employee salaries"
                  description="Assign a structure and CTC to employees."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee ID</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Structure</th>
                        <th className="px-3 py-2 font-medium">Effective</th>
                        <th className="px-3 py-2 font-medium">Monthly CTC</th>
                        <th className="px-3 py-2 font-medium">Annual CTC</th>
                        <th className="px-3 py-2 font-medium">Group</th>
                        <th className="px-3 py-2 font-medium">Bank</th>
                        <th className="px-3 py-2 font-medium">Tax</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.salaries.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs">{s.employeeId}</td>
                          <td className="px-3 py-2 font-medium">{s.employeeName}</td>
                          <td className="px-3 py-2">{s.structureName}</td>
                          <td className="px-3 py-2 text-xs">{s.effectiveDate || "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(s.monthlyCtc)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(s.annualCtc)}</td>
                          <td className="px-3 py-2">{s.payrollGroup}</td>
                          <td className="px-3 py-2 font-mono text-xs">{s.bankAccount || "—"}</td>
                          <td className="px-3 py-2 uppercase">{s.taxRegime}</td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={s.salaryStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "process" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <Input
                    placeholder="Search runs…"
                    value={filters.query}
                    onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(RUN_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <Button size="sm" className="cursor-pointer" onClick={() => setRunOpen(true)}>
                  <Plus className="size-3.5" />
                  Run Payroll
                </Button>
              </div>
              {pageRuns.length === 0 ? (
                <HrEmptyState
                  title="No payroll runs"
                  description="Select a month to sync attendance, leave, OT, bonuses, and loans."
                />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Run</th>
                          <th className="px-3 py-2 font-medium">Month</th>
                          <th className="px-3 py-2 font-medium">Employees</th>
                          <th className="px-3 py-2 font-medium">Gross</th>
                          <th className="px-3 py-2 font-medium">Deductions</th>
                          <th className="px-3 py-2 font-medium">Net</th>
                          <th className="px-3 py-2 font-medium">Synced</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRuns.map((r) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono text-xs">{r.runCode}</td>
                            <td className="px-3 py-2">{r.monthLabel}</td>
                            <td className="px-3 py-2 tabular-nums">{r.employeeCount}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(r.grossTotal)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(r.deductionTotal)}</td>
                            <td className="px-3 py-2 tabular-nums font-medium">
                              {formatInr(r.netTotal)}
                            </td>
                            <td className="px-3 py-2 text-[10px] text-muted-foreground">
                              {[
                                r.attendanceSynced && "Att",
                                r.leaveSynced && "Leave",
                                r.otSynced && "OT",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </td>
                            <td className="px-3 py-2">
                              <HrStatusBadge
                                status={RUN_STATUS_LABELS[r.status] ?? r.status}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 cursor-pointer text-xs"
                                  onClick={() => {
                                    void generatePayslips(r.id)
                                      .then((slips) => {
                                        toast(`${slips.length} payslips`);
                                        refresh();
                                      })
                                      .catch((e) =>
                                        toast(e instanceof Error ? e.message : "Failed", "error"),
                                      );
                                  }}
                                >
                                  Payslips
                                </Button>
                                {["pending_hr", "pending_finance", "draft", "processing"].includes(
                                  r.status,
                                ) ? (
                                  <Button
                                    size="sm"
                                    className="h-7 cursor-pointer text-xs"
                                    onClick={() => {
                                      try {
                                        advancePayrollApproval(r.id);
                                        toast("Advanced");
                                        refresh();
                                      } catch (e) {
                                        toast(e instanceof Error ? e.message : "Failed", "error");
                                      }
                                    }}
                                  >
                                    Advance
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <EmsPagination
                    page={page}
                    pageSize={PAGE}
                    total={runs.length}
                    onPageChange={setPage}
                  />
                </>
              )}
            </section>
          ) : null}

          {tab === "approvals" ? (
            <section className="space-y-3">
              {(dir?.runs.filter((r) =>
                ["pending_hr", "pending_finance", "approved", "paid"].includes(r.status),
              ).length ?? 0) === 0 ? (
                <HrEmptyState title="No approval items" />
              ) : (
                dir?.runs
                  .filter((r) =>
                    ["pending_hr", "pending_finance", "approved", "paid", "locked"].includes(
                      r.status,
                    ),
                  )
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">
                          {r.runCode} · {r.monthLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.employeeCount} employees · Net {formatInr(r.netTotal)}
                        </p>
                        <ApprovalTimeline status={r.status} />
                      </div>
                      {["pending_hr", "pending_finance"].includes(r.status) ? (
                        <Button
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => {
                            try {
                              advancePayrollApproval(r.id);
                              toast("Approval advanced");
                              refresh();
                            } catch (e) {
                              toast(e instanceof Error ? e.message : "Failed", "error");
                            }
                          }}
                        >
                          Approve next step
                        </Button>
                      ) : (
                        <HrStatusBadge status={RUN_STATUS_LABELS[r.status]} />
                      )}
                    </div>
                  ))
              )}
            </section>
          ) : null}

          {tab === "locks" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="cursor-pointer" onClick={() => setLockOpen(true)}>
                  <Lock className="size-3.5" />
                  Lock Payroll Month
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setUnlockOpen(true)}
                >
                  <Unlock className="size-3.5" />
                  Unlock Month
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Locked payroll cannot be edited. Attendance, leave, and salary are frozen. Only Super
                Admin can unlock.
              </p>
              {(dir?.locks.length ?? 0) === 0 ? (
                <HrEmptyState title="No locked months" description="Lock a month after payroll is paid." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                        <th className="px-3 py-2 font-medium">Approved By</th>
                        <th className="px-3 py-2 font-medium">Locked Date</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.locks.map((l) => (
                        <tr key={l.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{l.monthLabel}</td>
                          <td className="px-3 py-2 text-xs">{l.reason}</td>
                          <td className="px-3 py-2 text-xs">{l.approvedBy}</td>
                          <td className="px-3 py-2 text-xs">
                            {new Date(l.lockedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={l.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "revisions" ? (
            <section className="space-y-3">
              <Button size="sm" className="cursor-pointer" onClick={() => setRevisionOpen(true)}>
                <Plus className="size-3.5" />
                Salary Revision
              </Button>
              {(dir?.revisions.length ?? 0) === 0 ? (
                <HrEmptyState title="No salary revisions" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee</th>
                        <th className="px-3 py-2 font-medium">Old Salary</th>
                        <th className="px-3 py-2 font-medium">New Salary</th>
                        <th className="px-3 py-2 font-medium">Effective</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.revisions.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{r.employeeName}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(r.oldSalary)}</td>
                          <td className="px-3 py-2 tabular-nums font-medium">
                            {formatInr(r.newSalary)}
                          </td>
                          <td className="px-3 py-2 text-xs">{r.effectiveDate}</td>
                          <td className="px-3 py-2 capitalize">
                            <HrStatusBadge status={r.reason} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "bonuses" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="cursor-pointer" onClick={() => setBonusOpen(true)}>
                  <Plus className="size-3.5" />
                  Add Bonus
                </Button>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setAdjOpen(true)}>
                  <Plus className="size-3.5" />
                  Arrears / Incentive
                </Button>
              </div>
              {(dir?.bonuses.length ?? 0) === 0 && (dir?.adjustments.length ?? 0) === 0 ? (
                <HrEmptyState title="No bonuses" description="Festival, performance, retention, referral, arrears, incentives." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.bonuses.map((b) => (
                        <tr key={b.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{b.employeeName}</td>
                          <td className="px-3 py-2 capitalize">{b.bonusType}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(b.amount)}</td>
                          <td className="px-3 py-2 text-xs">{b.month}</td>
                        </tr>
                      ))}
                      {dir?.adjustments.map((a) => (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{a.employeeName}</td>
                          <td className="px-3 py-2 capitalize">
                            {a.kind} · {a.status}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(a.amount)}</td>
                          <td className="px-3 py-2 text-xs">{a.month}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "reimbursements" ? (
            <section className="space-y-3">
              <Button size="sm" className="cursor-pointer" onClick={() => setReimbOpen(true)}>
                <Plus className="size-3.5" />
                Add Reimbursement
              </Button>
              {(dir?.reimbursements.length ?? 0) === 0 ? (
                <HrEmptyState title="No reimbursements" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.reimbursements.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{r.employeeName}</td>
                          <td className="px-3 py-2 capitalize">{r.reimbType}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(r.amount)}</td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2">
                            {r.status === "pending" ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 cursor-pointer text-xs"
                                  onClick={() => {
                                    approveReimbursement(r.id, "approved");
                                    toast("Approved");
                                    refresh();
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 cursor-pointer text-xs"
                                  onClick={() => {
                                    approveReimbursement(r.id, "rejected");
                                    toast("Rejected");
                                    refresh();
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "loans" ? (
            <section className="space-y-3">
              <Button size="sm" className="cursor-pointer" onClick={() => setLoanOpen(true)}>
                <Plus className="size-3.5" />
                Add Loan / Advance
              </Button>
              {(dir?.loans.length ?? 0) === 0 ? (
                <HrEmptyState title="No loans or advances" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Employee</th>
                        <th className="px-3 py-2 font-medium">Loan Amount</th>
                        <th className="px-3 py-2 font-medium">Installments</th>
                        <th className="px-3 py-2 font-medium">Remaining</th>
                        <th className="px-3 py-2 font-medium">Recovery / mo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.loans.map((l) => (
                        <tr key={l.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">{l.employeeName}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(l.loanAmount)}</td>
                          <td className="px-3 py-2 tabular-nums">{l.installments}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatInr(l.remainingBalance)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatInr(l.recoveryPerMonth)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {tab === "payslips" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="cursor-pointer" onClick={handleGeneratePayslips}>
                  <FileText className="size-3.5" />
                  Generate Payslips
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={!dir?.payslips.length}
                  onClick={() => {
                    const all = (dir?.payslips ?? [])
                      .slice(0, 50)
                      .map(exportPayslipText)
                      .join("\n\n");
                    downloadTextFile(`payslips-bulk-${Date.now()}.txt`, all);
                    toast("Bulk download started");
                  }}
                >
                  <Download className="size-3.5" />
                  Bulk Download
                </Button>
              </div>
              {(dir?.payslips.length ?? 0) === 0 ? (
                <HrEmptyState
                  title="No payslips"
                  description="Generate payslips after a payroll run."
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Payslip</th>
                          <th className="px-3 py-2 font-medium">Employee</th>
                          <th className="px-3 py-2 font-medium">Month</th>
                          <th className="px-3 py-2 font-medium">Net</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dir?.payslips.slice(0, 50).map((p) => (
                          <tr
                            key={p.id}
                            className={cn(
                              "cursor-pointer border-b border-border/50 hover:bg-muted/30",
                              preview?.id === p.id && "bg-muted/40",
                            )}
                            onClick={() => setPreview(p)}
                          >
                            <td className="px-3 py-2 font-mono text-xs">{p.payslipCode}</td>
                            <td className="px-3 py-2 font-medium">{p.employeeName}</td>
                            <td className="px-3 py-2 text-xs">{p.monthLabel}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(p.net)}</td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 cursor-pointer text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadTextFile(
                                    `${p.payslipCode}.txt`,
                                    exportPayslipText(p),
                                  );
                                  toast("Downloaded");
                                }}
                              >
                                Download
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    {preview ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                              Company Logo
                            </p>
                            <p className="text-sm font-semibold">Enterprise ERP</p>
                          </div>
                          <div className="size-12 rounded border border-dashed border-border grid place-items-center text-[9px] text-muted-foreground">
                            QR
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-medium">{preview.employeeName}</p>
                          <p className="text-muted-foreground">
                            {preview.employeeId} · {preview.department}
                          </p>
                          <p className="text-muted-foreground">Bank: {preview.bankAccount}</p>
                          <p className="text-muted-foreground">
                            Attendance: {preview.presentDays} present · {preview.leaveDays} leave
                          </p>
                          <p className="text-muted-foreground">Period: {preview.monthLabel}</p>
                        </div>
                        <div>
                          <p className="mb-1 font-semibold">Earnings</p>
                          {preview.earnings.map((e) => (
                            <div key={e.label} className="flex justify-between tabular-nums">
                              <span>{e.label}</span>
                              <span>{formatInr(e.amount)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                            <span>Gross</span>
                            <span>{formatInr(preview.gross)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 font-semibold">Deductions</p>
                          {preview.deductions.map((d) => (
                            <div key={d.label} className="flex justify-between tabular-nums">
                              <span>{d.label}</span>
                              <span>{formatInr(d.amount)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                            <span>Total</span>
                            <span>{formatInr(preview.totalDeductions)}</span>
                          </div>
                        </div>
                        <div className="rounded-lg bg-primary/5 px-3 py-2 flex justify-between font-semibold">
                          <span>Net Salary</span>
                          <span>{formatInr(preview.net)}</span>
                        </div>
                        <p className="text-muted-foreground">
                          Tax regime: {preview.taxRegime} · Digital signature on file
                        </p>
                        <Button
                          size="sm"
                          className="w-full cursor-pointer"
                          onClick={() => {
                            downloadTextFile(
                              `${preview.payslipCode}.txt`,
                              exportPayslipText(preview),
                            );
                            toast("Payslip downloaded");
                          }}
                        >
                          Download / Email Ready
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Select a payslip to preview.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {tab === "reports" ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Payroll Register",
                  desc: "Full run register with gross, deductions, net",
                  export: () =>
                    downloadTextFile(
                      "payroll-register.csv",
                      exportRunsCsv(dir?.runs ?? []),
                      "text/csv",
                    ),
                },
                {
                  title: "Bank Transfer Report",
                  desc: "Net pay by employee for bank file",
                  export: () => {
                    const h = "Employee,Bank,Net\n";
                    const rows = (dir?.payslips ?? [])
                      .map(
                        (p) =>
                          `"${p.employeeName}","${p.bankAccount}",${p.net}`,
                      )
                      .join("\n");
                    downloadTextFile("bank-transfer.csv", h + rows, "text/csv");
                  },
                },
                {
                  title: "PF Report",
                  desc: "Provident Fund statutory extract",
                  export: () => {
                    const rows = (dir?.structures ?? [])
                      .map((s) => `"${s.name}",${s.pf}`)
                      .join("\n");
                    downloadTextFile("pf-report.csv", "Structure,PF\n" + rows, "text/csv");
                  },
                },
                {
                  title: "ESI Report",
                  desc: "Employee State Insurance extract",
                  export: () => {
                    const rows = (dir?.structures ?? [])
                      .map((s) => `"${s.name}",${s.esi}`)
                      .join("\n");
                    downloadTextFile("esi-report.csv", "Structure,ESI\n" + rows, "text/csv");
                  },
                },
                {
                  title: "TDS Report",
                  desc: "Income tax withholding summary",
                  export: () => {
                    const rows = (dir?.structures ?? [])
                      .map((s) => `"${s.name}",${s.tds}`)
                      .join("\n");
                    downloadTextFile("tds-report.csv", "Structure,TDS\n" + rows, "text/csv");
                  },
                },
                {
                  title: "Salary Summary",
                  desc: "Monthly CTC rollup by employee",
                  export: () => {
                    const h = "Employee,Monthly CTC,Annual CTC\n";
                    const rows = (dir?.salaries ?? [])
                      .map(
                        (s) =>
                          `"${s.employeeName}",${s.monthlyCtc},${s.annualCtc}`,
                      )
                      .join("\n");
                    downloadTextFile("salary-summary.csv", h + rows, "text/csv");
                  },
                },
                {
                  title: "Department Payroll",
                  desc: "Net pay grouped by department",
                  export: () => {
                    const map = new Map<string, number>();
                    for (const p of dir?.payslips ?? []) {
                      map.set(p.department, (map.get(p.department) ?? 0) + p.net);
                    }
                    const rows = [...map.entries()]
                      .map(([d, n]) => `"${d}",${n}`)
                      .join("\n");
                    downloadTextFile(
                      "department-payroll.csv",
                      "Department,Net\n" + rows,
                      "text/csv",
                    );
                  },
                },
                {
                  title: "Yearly Payroll",
                  desc: "Annual net by payroll month",
                  export: () => {
                    downloadTextFile(
                      "yearly-payroll.csv",
                      exportRunsCsv(dir?.runs ?? []),
                      "text/csv",
                    );
                  },
                },
              ].map((r) => (
                <div
                  key={r.title}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <h3 className="text-sm font-semibold">{r.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 cursor-pointer"
                    onClick={() => {
                      r.export();
                      toast("Exported");
                    }}
                  >
                    <Download className="size-3.5" />
                    Export Excel/CSV
                  </Button>
                </div>
              ))}
            </section>
          ) : null}

          {tab === "audit" ? (
            <section>
              {audit.length === 0 ? (
                <HrEmptyState title="No audit events yet" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Detail</th>
                        <th className="px-3 py-2 font-medium">Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.slice(0, 100).map((a) => (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            {new Date(a.at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={a.action.replace(/_/g, " ")} />
                          </td>
                          <td className="px-3 py-2 text-xs">{a.detail}</td>
                          <td className="px-3 py-2 text-xs">{a.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}

      <StructureDrawer
        open={structureOpen}
        initial={editingStructure}
        onClose={() => {
          setStructureOpen(false);
          setEditingStructure(null);
        }}
        onSubmit={async (input) => {
          if (editingStructure) {
            await updateStructure(editingStructure.id, input);
            toast("Structure updated");
          } else {
            await createStructure(input);
            toast("Structure created");
          }
          setEditingStructure(null);
          refresh();
        }}
      />
      <RunPayrollDrawer
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onSubmit={async (month) => {
          try {
            await runPayroll(month);
            toast(`Payroll run for ${month}`);
            refresh();
            setTab("process");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
      />
      <RevisionDrawer
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        salaries={dir?.salaries ?? []}
        employees={employees}
        onSubmit={(input) => {
          try {
            createRevision(input);
            toast("Salary revised");
            refresh();
            setTab("revisions");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
      />
      <LockMonthDrawer
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        mode="lock"
        onSubmit={(month, reason) => {
          lockPayrollMonth(month, reason);
          toast("Month locked");
          refresh();
          setTab("locks");
        }}
      />
      <LockMonthDrawer
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        mode="unlock"
        onSubmit={(month, reason) => {
          try {
            unlockPayrollMonth(month, reason);
            toast("Month unlocked");
            refresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
      />
      <AssignSalaryDrawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        structures={dir?.structures ?? []}
        employees={employees}
        onSubmit={async (input) => {
          await assignEmployeeSalary(input);
          toast("Salary assigned");
          refresh();
        }}
      />
      <BonusDrawer
        open={bonusOpen}
        onClose={() => setBonusOpen(false)}
        employees={employees}
        onSubmit={(input) => {
          void addBonus(input)
            .then(() => {
              toast("Bonus added");
              refresh();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <AdjustmentDrawer
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        employees={employees}
        onSubmit={(input) => {
          void addPayrollAdjustment(input)
            .then(() => {
              toast("Adjustment applied");
              refresh();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
        }}
      />
      <ReimbDrawer
        open={reimbOpen}
        onClose={() => setReimbOpen(false)}
        employees={employees}
        onSubmit={(input) => {
          void addReimbursement({ ...input, status: "pending" });
          toast("Reimbursement submitted");
          refresh();
        }}
      />
      <LoanDrawer
        open={loanOpen}
        onClose={() => setLoanOpen(false)}
        employees={employees}
        onSubmit={(input) => {
          void addLoan(input);
          toast("Loan recorded");
          refresh();
        }}
      />
    </div>
  );
}
