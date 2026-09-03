"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";

import {
  AssignSalaryDrawer,
  AdjustmentDrawer,
  BonusDrawer,
  RevisionDrawer,
} from "@/components/hr/payroll/payroll-drawers";
import { PayrollPolicyPanel } from "@/components/hr/payroll/payroll-policy-panel";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  addBonus,
  addPayrollAdjustment,
  assignEmployeeSalary,
  createRevision,
  deleteEmployeeSalary,
  deleteStructure,
  downloadTextFile,
  exportPayslipText,
  filterRuns,
  formatInr,
  generatePayslips,
  importStructuresCsv,
  isMonthLocked,
  loadPayrollDirectory,
  lockPayrollMonth,
  resetStructuresToCacheDigitech,
  unlockPayrollMonth,
  type PayrollDirectory,
} from "@/services/payroll-management-service";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import type {
  PayslipRecord,
  EmployeeSalary,
  PayrollRun,
  SalaryStructure,
} from "@/types/payroll-management";
import {
  emptyPayrollFilters,
  RUN_STATUS_LABELS,
  structureCtc,
} from "@/types/payroll-management";

const PAGE = 10;

const PAYROLL_SECTIONS = [
  "salary-structure",
  "assign-salary",
  "run-payroll",
  "payslip",
  "revised-salary",
  "incentives",
  "salary-configuration",
] as const;

export type PayrollSection = (typeof PAYROLL_SECTIONS)[number];

const SECTION_META: Record<PayrollSection, { title: string; description?: string }> = {
  "salary-structure": {
    title: "Salary structure",
    description: "CTC templates with Excel payroll formulas. Open a form to create or edit.",
  },
  "assign-salary": {
    title: "Assign salary",
    description: "Map employees to a structure, CTC, bank, and tax regime.",
  },
  "run-payroll": {
    title: "Run payroll",
  },
  payslip: {
    title: "Payslip",
    description: "Generate and download employee payslips after a payroll run.",
  },
  "revised-salary": {
    title: "Revised salary",
    description: "Record salary revisions with effective dates.",
  },
  incentives: {
    title: "Incentives",
    description: "Festival, performance, retention, referral, arrears, and incentives.",
  },
  "salary-configuration": {
    title: "Salary configuration",
    description: "Company payroll policy: 30-day salary basis, sandwich, and PF.",
  },
};

function parseSection(raw: string | null): PayrollSection {
  if (raw && (PAYROLL_SECTIONS as readonly string[]).includes(raw)) {
    return raw as PayrollSection;
  }
  return "salary-structure";
}

export function PayrollManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = parseSection(searchParams.get("section"));

  const [dir, setDir] = useState<PayrollDirectory | null>(null);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => emptyPayrollFilters());
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<PayslipRecord | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [revisionOpen, setRevisionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<EmployeeSalary | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SalaryStructure | null>(null);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState<EmployeeSalary | null>(null);
  const [confirmLock, setConfirmLock] = useState<{ run: PayrollRun; mode: "lock" | "unlock" } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    const raw = searchParams.get("section");
    if (!raw || !(PAYROLL_SECTIONS as readonly string[]).includes(raw)) {
      router.replace("/hr/payroll?section=salary-structure");
    }
  }, [router, searchParams]);

  useEffect(() => setPage(1), [filters, section]);

  const runs = useMemo(() => filterRuns(dir?.runs ?? [], filters), [dir, filters]);
  const pageRuns = useMemo(() => {
    const s = (page - 1) * PAGE;
    return runs.slice(s, s + PAGE);
  }, [runs, page]);
  const runMonths = useMemo(() => {
    const seen = new Set<string>();
    const rows: { value: string; label: string }[] = [];
    for (const r of dir?.runs ?? []) {
      if (seen.has(r.month)) continue;
      seen.add(r.month);
      rows.push({ value: r.month, label: r.monthLabel || r.month });
    }
    return rows;
  }, [dir]);
  const authBlocked =
    !isAuthenticated() &&
    !loading &&
    !(dir?.structures.length || dir?.runs.length || dir?.salaries.length);

  function refresh() {
    void load();
  }

  function goSection(next: PayrollSection) {
    router.replace(`/hr/payroll?section=${next}`);
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
      goSection("payslip");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  const meta = SECTION_META[section];

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            {section === "salary-structure" ? (
              <>
                <Button
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => router.push("/hr/payroll/salary-structures/new")}
                >
                  <Plus className="size-3.5" />
                  Salary structure
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Import
                </Button>
              </>
            ) : null}
            {section === "assign-salary" ? (
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  setEditingSalary(null);
                  setAssignOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Assign salary
              </Button>
            ) : null}
            {section === "run-payroll" ? (
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => router.push("/hr/payroll/runs/new")}
              >
                <Plus className="size-3.5" />
                Run payroll
              </Button>
            ) : null}
            {section === "payslip" ? (
              <>
                <Button size="sm" className="cursor-pointer" onClick={() => void handleGeneratePayslips()}>
                  <FileText className="size-3.5" />
                  Generate payslips
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
                  Bulk download
                </Button>
              </>
            ) : null}
            {section === "revised-salary" ? (
              <Button size="sm" className="cursor-pointer" onClick={() => setRevisionOpen(true)}>
                <Plus className="size-3.5" />
                Revised salary
              </Button>
            ) : null}
            {section === "incentives" ? (
              <>
                <Button size="sm" className="cursor-pointer" onClick={() => setBonusOpen(true)}>
                  <Plus className="size-3.5" />
                  Add incentive
                </Button>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setAdjOpen(true)}>
                  <Plus className="size-3.5" />
                  Arrears
                </Button>
              </>
            ) : null}
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !dir ? (
        <EmsSkeleton rows={6} />
      ) : (
        <>
          {section === "salary-structure" ? (
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={async () => {
                    try {
                      const rows = await resetStructuresToCacheDigitech();
                      toast(`Created ${rows.length} Excel CTC templates`);
                      refresh();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Failed to load templates", "error");
                    }
                  }}
                >
                    Load sample templates
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const name = f.name.toLowerCase();
                      let text: string;
                      if (name.endsWith(".csv") || f.type === "text/csv") {
                        text = await f.text();
                      } else {
                        const { extractDataMatrix, matrixToCsv, parseSpreadsheetFileAsMatrix } =
                          await import("@/lib/spreadsheet");
                        const matrix = extractDataMatrix(
                          await parseSpreadsheetFileAsMatrix(f),
                          "name",
                        );
                        text = matrixToCsv(matrix);
                      }
                      const n = importStructuresCsv(text);
                      toast(`Imported ${n} structures`);
                      refresh();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Import failed", "error");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              {(dir?.structures.length ?? 0) === 0 ? (
                <HrEmptyState title="No salary structures" description="Create a CTC template with Gross CTC and Excel formulas." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Structure</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Gross CTC</th>
                        <th className="px-3 py-2 font-medium">Basic</th>
                        <th className="px-3 py-2 font-medium">HRA</th>
                        <th className="px-3 py-2 font-medium">Special</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.structures.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={s.status || "draft"} />
                          </td>
                          <td className="px-3 py-2 tabular-nums font-medium">
                            {formatInr(s.grossCtc && s.grossCtc > 0 ? s.grossCtc : structureCtc(s))}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(s.basic)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(s.hra)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatInr(s.specialAllowance)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                                aria-label={`View ${s.name}`}
                                title="View"
                                onClick={() =>
                                  router.push(`/hr/payroll/salary-structures/${s.id}?mode=view`)
                                }
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                                aria-label={`Edit ${s.name}`}
                                title="Edit"
                                onClick={() => router.push(`/hr/payroll/salary-structures/${s.id}`)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                                aria-label={`Delete ${s.name}`}
                                title="Delete"
                                onClick={() => setConfirmDelete(s)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {section === "assign-salary" ? (
            <section className="space-y-3">
              {(dir?.salaries.length ?? 0) === 0 ? (
                <HrEmptyState
                  title="No assigned salaries"
                  description="Assign a structure and CTC to employees."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Salary</th>
                        <th className="px-3 py-2 font-medium">Effective date</th>
                        <th className="px-3 py-2 font-medium">Bank name</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dir?.salaries.map((s) => {
                        const emp = employees.find(
                          (e) => e.id === s.employeeId || e.code === s.employeeId,
                        );
                        const displayName = emp?.label.split(" · ")[0] || s.employeeName;
                        const bankName = s.bankName || emp?.bankName || "—";
                        return (
                          <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{displayName}</td>
                            <td className="px-3 py-2 tabular-nums">{formatInr(s.monthlyCtc)}</td>
                            <td className="px-3 py-2 text-xs">{s.effectiveDate || "—"}</td>
                            <td className="px-3 py-2">{bankName}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                                  aria-label={`Edit ${displayName}`}
                                  title="Edit"
                                  onClick={() => {
                                    setEditingSalary(s);
                                    setAssignOpen(true);
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                                  aria-label={`Delete ${displayName}`}
                                  title="Delete"
                                  onClick={() => setConfirmDeleteAssignment(s)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
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

          {section === "run-payroll" ? (
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
                  className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                  value={filters.month}
                  onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
                >
                  <option value="all">All months</option>
                  <option value="custom">Custom month</option>
                  <option value="range">Date range</option>
                  {runMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {filters.month === "custom" ? (
                  <Input
                    type="month"
                    className="h-9 w-[160px]"
                    value={filters.customMonth}
                    onChange={(e) => setFilters((f) => ({ ...f, customMonth: e.target.value }))}
                  />
                ) : null}
                {filters.month === "range" ? (
                  <>
                    <Input
                      type="date"
                      className="h-9 w-[150px]"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                      aria-label="From date"
                    />
                    <Input
                      type="date"
                      className="h-9 w-[150px]"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                      aria-label="To date"
                    />
                  </>
                ) : null}
                <select
                  className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="all">All</option>
                  <option value="locked">Lock</option>
                  <option value="unlocked">Unlock</option>
                  <option value="run">Run payroll</option>
                </select>
              </div>
              {pageRuns.length === 0 ? (
                <HrEmptyState title="No payroll runs" />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Pay cycle</th>
                          <th className="px-3 py-2 font-medium">Employees</th>
                          <th className="px-3 py-2 font-medium">Gross</th>
                          <th className="px-3 py-2 font-medium">Deductions</th>
                          <th className="px-3 py-2 font-medium">Net</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 text-right font-medium">Lock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRuns.map((r) => {
                          const locked = isMonthLocked(r.month) || r.status === "locked";
                          return (
                            <tr
                              key={r.id}
                              className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                              onClick={() => router.push(`/hr/payroll/runs/${r.id}`)}
                            >
                              <td className="px-3 py-2 text-xs">
                                <span className="font-medium">{r.cycleLabel || r.monthLabel}</span>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{r.employeeCount}</td>
                              <td className="px-3 py-2 tabular-nums">{formatInr(r.grossTotal)}</td>
                              <td className="px-3 py-2 tabular-nums">{formatInr(r.deductionTotal)}</td>
                              <td className="px-3 py-2 tabular-nums font-medium">
                                {formatInr(r.netTotal)}
                              </td>
                              <td className="px-3 py-2">
                                <HrStatusBadge status={RUN_STATUS_LABELS[r.status] ?? r.status} />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                                    aria-label={locked ? `Unlock ${r.monthLabel}` : `Lock ${r.monthLabel}`}
                                    title={locked ? "Unlock" : "Lock"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmLock({ run: r, mode: locked ? "unlock" : "lock" });
                                    }}
                                  >
                                    {locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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

          {section === "revised-salary" ? (
            <section className="space-y-3">
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
                          <td className="px-3 py-2 tabular-nums font-medium">{formatInr(r.newSalary)}</td>
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

          {section === "incentives" ? (
            <section className="space-y-3">
              {(dir?.bonuses.length ?? 0) === 0 && (dir?.adjustments.length ?? 0) === 0 ? (
                <HrEmptyState
                  title="No incentives"
                  description="Festival, performance, retention, referral, arrears, incentives."
                />
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

          {section === "payslip" ? (
            <section className="space-y-3">
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
                                  downloadTextFile(`${p.payslipCode}.txt`, exportPayslipText(p));
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
                          <div className="grid size-12 place-items-center rounded border border-dashed border-border text-[9px] text-muted-foreground">
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
                            {preview.monthLabel ? ` · ${preview.monthLabel}` : ""}
                          </p>
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
                        <div className="flex justify-between rounded-lg bg-primary/5 px-3 py-2 font-semibold">
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
                            downloadTextFile(`${preview.payslipCode}.txt`, exportPayslipText(preview));
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

          {section === "salary-configuration" ? (
            <section>
              <PayrollPolicyPanel />
            </section>
          ) : null}
        </>
      )}

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
            goSection("revised-salary");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
      />
      <AssignSalaryDrawer
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setEditingSalary(null);
        }}
        structures={dir?.structures ?? []}
        employees={employees}
        initial={editingSalary}
        onSubmit={async (input) => {
          const wasEdit = Boolean(editingSalary);
          await assignEmployeeSalary(input);
          toast(wasEdit ? "Salary updated" : "Salary assigned");
          setEditingSalary(null);
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
              toast("Incentive added");
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
      <SetupConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete salary structure"
        message={
          confirmDelete
            ? `Remove “${confirmDelete.name}”? Employees assigned to this template must be reassigned first.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          setDeleting(true);
          void deleteStructure(confirmDelete.id)
            .then(() => {
              toast("Salary structure deleted");
              setConfirmDelete(null);
              refresh();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Delete failed", "error"))
            .finally(() => setDeleting(false));
        }}
      />
      <SetupConfirmDialog
        open={Boolean(confirmDeleteAssignment)}
        title="Delete assigned salary"
        message={
          confirmDeleteAssignment
            ? `Remove salary assignment for “${
                employees.find(
                  (e) =>
                    e.id === confirmDeleteAssignment.employeeId ||
                    e.code === confirmDeleteAssignment.employeeId,
                )?.label.split(" · ")[0] || confirmDeleteAssignment.employeeName
              }”?`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDeleteAssignment(null)}
        onConfirm={() => {
          if (!confirmDeleteAssignment) return;
          setDeleting(true);
          void deleteEmployeeSalary(confirmDeleteAssignment.id)
            .then(() => {
              toast("Salary assignment deleted");
              setConfirmDeleteAssignment(null);
              refresh();
            })
            .catch((e) => toast(e instanceof Error ? e.message : "Delete failed", "error"))
            .finally(() => setDeleting(false));
        }}
      />
      <SetupConfirmDialog
        open={Boolean(confirmLock)}
        title={confirmLock?.mode === "unlock" ? "Unlock month" : "Lock month"}
        message={
          confirmLock
            ? confirmLock.mode === "unlock"
              ? `Unlock ${confirmLock.run.monthLabel}?`
              : `Lock ${confirmLock.run.monthLabel}?`
            : ""
        }
        confirmLabel={confirmLock?.mode === "unlock" ? "Unlock" : "Lock"}
        loading={deleting}
        onCancel={() => setConfirmLock(null)}
        onConfirm={() => {
          if (!confirmLock) return;
          setDeleting(true);
          try {
            if (confirmLock.mode === "lock") {
              lockPayrollMonth(confirmLock.run.month, "Locked from payroll run");
              toast("Month locked");
            } else {
              unlockPayrollMonth(confirmLock.run.month, "Unlocked from payroll run");
              toast("Month unlocked");
            }
            setConfirmLock(null);
            refresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
