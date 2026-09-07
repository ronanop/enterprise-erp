"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import {
  AssignSalaryDrawer,
  AdjustmentDrawer,
  BonusDrawer,
  RevisionDrawer,
} from "@/components/hr/payroll/payroll-drawers";
import { PayrollPolicyPanel } from "@/components/hr/payroll/payroll-policy-panel";
import { PayrollRunWorkspace } from "@/components/hr/payroll/payroll-run-workspace";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupDrawer, SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import {
  addBonus,
  addPayrollAdjustment,
  assignEmployeeSalary,
  createRevision,
  deleteEmployeeSalary,
  deleteStructure,
  formatInr,
  generatePayslips,
  importStructuresCsv,
  loadPayrollDirectory,
  findPayrollRunForMonth,
  resetStructuresToCacheDigitech,
  uniqueRunsByMonth,
  type PayrollDirectory,
} from "@/services/payroll-management-service";
import { PayslipLetterhead } from "@/components/hr/payroll/payslip-letterhead";
import { downloadPayslipPdf, downloadPayslipsPdf, payslipPdfContext } from "@/utils/payslip-pdf";
import {
  loadHrMasterDirectory,
  type HrMasterOption,
} from "@/services/hr-master-connector";
import type {
  PayslipRecord,
  EmployeeSalary,
  SalaryStructure,
} from "@/types/payroll-management";
import {
  monthLabel,
  RUN_STATUS_LABELS,
  structureCtc,
} from "@/types/payroll-management";

const SLIP_PAGE = 15;

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
    description: "Click a month, then an employee. Generate payroll on this tab.",
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
    description: "30-day salary basis, sandwich policy, and provident fund.",
  },
};

function parseSection(raw: string | null): PayrollSection {
  if (raw === "provident-fund") return "salary-configuration";
  if (raw && (PAYROLL_SECTIONS as readonly string[]).includes(raw)) {
    return raw as PayrollSection;
  }
  return "salary-structure";
}

function payslipEmployeeCode(p: PayslipRecord, employees: HrMasterOption[]): string {
  const fromMaster = employees.find((e) => e.id === p.employeeId)?.code;
  return (p.employeeCode || fromMaster || "").trim();
}

export function PayrollManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = parseSection(searchParams.get("section"));

  const [dir, setDir] = useState<PayrollDirectory | null>(null);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [viewSlip, setViewSlip] = useState<PayslipRecord | null>(null);
  const [slipQuery, setSlipQuery] = useState("");
  const [slipOpenMonth, setSlipOpenMonth] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState("");
  const [generating, setGenerating] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const [revisionOpen, setRevisionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<EmployeeSalary | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SalaryStructure | null>(null);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState<EmployeeSalary | null>(null);
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
    if (raw === "provident-fund") {
      router.replace("/hr/payroll?section=salary-configuration");
      return;
    }
    if (!raw || !(PAYROLL_SECTIONS as readonly string[]).includes(raw)) {
      router.replace("/hr/payroll?section=salary-structure");
    }
  }, [router, searchParams]);

  useEffect(() => setPage(1), [section, slipQuery, slipOpenMonth]);

  useEffect(() => {
    if (section !== "payslip") return;
    const monthParam = (searchParams.get("month") || "").slice(0, 7);
    if (monthParam) setSlipOpenMonth(monthParam);
    if (searchParams.get("generate") !== "1") return;
    setGenerateMonth(monthParam);
    setGenerateOpen(true);
    router.replace(monthParam ? `/hr/payroll?section=payslip&month=${monthParam}` : "/hr/payroll?section=payslip");
  }, [section, searchParams, router]);

  const payrollMonths = useMemo(() => {
    const byMonth = new Map<
      string,
      {
        month: string;
        label: string;
        cycleLabel: string;
        employeeCount: number;
        netTotal: number;
        runId: string;
        slipCount: number;
        status: string;
      }
    >();
    for (const r of uniqueRunsByMonth(dir?.runs ?? [])) {
      const month = r.month.slice(0, 7);
      byMonth.set(month, {
        month,
        label: monthLabel(month),
        cycleLabel: r.cycleLabel || r.monthLabel,
        employeeCount: r.employeeCount,
        netTotal: r.netTotal,
        runId: r.id,
        slipCount: 0,
        status: r.status,
      });
    }
    for (const p of dir?.payslips ?? []) {
      const month = (p.month || "").slice(0, 7);
      const viaRun = [...byMonth.values()].find((row) => row.runId && row.runId === p.runId);
      const target = viaRun ?? (month ? byMonth.get(month) : undefined);
      if (!target) {
        if (!month) continue;
        byMonth.set(month, {
          month,
          label: p.monthLabel || monthLabel(month),
          cycleLabel: p.monthLabel || monthLabel(month),
          employeeCount: 1,
          netTotal: p.net,
          runId: p.runId,
          slipCount: 1,
          status: "generated",
        });
        continue;
      }
      target.slipCount += 1;
      if (!target.runId) target.runId = p.runId;
    }
    return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [dir]);

  const filteredPayslips = useMemo(() => {
    const q = slipQuery.trim().toLowerCase();
    const openRun = uniqueRunsByMonth(dir?.runs ?? []).find((r) => r.month.slice(0, 7) === slipOpenMonth);
    return (dir?.payslips ?? []).filter((p) => {
      const code = payslipEmployeeCode(p, employees);
      if (q) {
        const hay = `${p.employeeName} ${code} ${p.payslipCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (slipOpenMonth) {
        const sameMonth = p.month.slice(0, 7) === slipOpenMonth;
        const sameRun = Boolean(openRun && p.runId && p.runId === openRun.id);
        if (!sameMonth && !sameRun) return false;
      }
      return true;
    });
  }, [dir, employees, slipOpenMonth, slipQuery]);

  const pagePayslips = useMemo(() => {
    const s = (page - 1) * SLIP_PAGE;
    return filteredPayslips.slice(s, s + SLIP_PAGE);
  }, [filteredPayslips, page]);

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

  async function handleGeneratePayslips(monthOverride?: string) {
    const ym = (monthOverride || generateMonth || slipOpenMonth).slice(0, 7);
    const run = findPayrollRunForMonth(dir?.runs ?? [], ym);
    if (!run) {
      toast("Run payroll for that month first", "error");
      return;
    }
    setGenerating(true);
    try {
      const slips = await generatePayslips(run.id);
      toast(`Generated ${slips.length} payslips for ${monthLabel(ym)}`);
      setGenerateOpen(false);
      setSlipOpenMonth(run.month.slice(0, 7));
      setDir((d) =>
        d
          ? {
              ...d,
              payslips: [
                ...slips,
                ...d.payslips.filter(
                  (p) => p.runId !== run.id && p.month.slice(0, 7) !== run.month.slice(0, 7),
                ),
              ],
            }
          : d,
      );
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setGenerating(false);
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
            {section === "payslip" ? (
              <>
                <Button
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setGenerateMonth(slipOpenMonth || payrollMonths[0]?.month || "");
                    setGenerateOpen(true);
                  }}
                >
                  <FileText className="size-3.5" />
                  Generate slip
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={!slipOpenMonth || !filteredPayslips.length}
                  onClick={async () => {
                    try {
                      await downloadPayslipsPdf(
                        filteredPayslips.map((p) => ({
                          slip: p,
                          ctx: payslipPdfContext(p, employees),
                        })),
                        `salary-slips-${slipOpenMonth}.pdf`,
                      );
                      toast("PDF downloaded");
                    } catch {
                      toast("Could not download PDF", "error");
                    }
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
            <PayrollRunWorkspace dir={dir} employees={employees} onRefresh={refresh} />
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
              {!slipOpenMonth ? (
                payrollMonths.length === 0 ? (
                  <HrEmptyState
                    title="No payroll months"
                    description="Run payroll for a month, then generate slips for that month."
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Month</th>
                            <th className="px-3 py-2 font-medium">Pay cycle</th>
                            <th className="px-3 py-2 font-medium">Employees</th>
                            <th className="px-3 py-2 font-medium">Slips</th>
                            <th className="px-3 py-2 font-medium">Net</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollMonths.map((m) => (
                            <tr
                              key={m.month}
                              className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                              onClick={() => setSlipOpenMonth(m.month)}
                            >
                              <td className="px-3 py-2 font-medium">{m.label}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{m.cycleLabel}</td>
                              <td className="px-3 py-2 tabular-nums">{m.employeeCount}</td>
                              <td className="px-3 py-2 tabular-nums">{m.slipCount}</td>
                              <td className="px-3 py-2 tabular-nums">{formatInr(m.netTotal)}</td>
                              <td className="px-3 py-2">
                                <HrStatusBadge status={RUN_STATUS_LABELS[m.status as keyof typeof RUN_STATUS_LABELS] ?? m.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setSlipOpenMonth("");
                        setSlipQuery("");
                      }}
                    >
                      <ChevronLeft className="size-3.5" />
                      All months
                    </Button>
                    <p className="text-sm font-medium">{monthLabel(slipOpenMonth)}</p>
                    <div className="min-w-[180px] flex-1">
                      <Input
                        className="h-8"
                        placeholder="Search name or code…"
                        value={slipQuery}
                        onChange={(e) => setSlipQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  {filteredPayslips.length === 0 ? (
                    <HrEmptyState
                      title="No slips for this month"
                      description="Generate slips from the payroll run for this month."
                      action={
                        <Button
                          size="sm"
                          className="cursor-pointer"
                          disabled={generating}
                          onClick={() => void handleGeneratePayslips(slipOpenMonth)}
                        >
                          <FileText className="size-3.5" />
                          {generating ? "Generating…" : "Generate slip"}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Employee code</th>
                              <th className="px-3 py-2 font-medium">Name</th>
                              <th className="px-3 py-2 font-medium">Month</th>
                              <th className="px-3 py-2 font-medium">Net pay</th>
                              <th className="px-3 py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagePayslips.map((p) => {
                              const code = payslipEmployeeCode(p, employees);
                              return (
                                <tr
                                  key={p.id}
                                  className="border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                                >
                                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                    {code || "—"}
                                  </td>
                                  <td className="px-3 py-2 font-medium">{p.employeeName}</td>
                                  <td className="px-3 py-2 text-xs">{p.monthLabel}</td>
                                  <td className="px-3 py-2 tabular-nums">{formatInr(p.net)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 cursor-pointer text-xs"
                                        onClick={() => setViewSlip(p)}
                                      >
                                        <Eye className="size-3.5" />
                                        View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 cursor-pointer text-xs"
                                        onClick={async () => {
                                          try {
                                            await downloadPayslipPdf(
                                              p,
                                              payslipPdfContext(p, employees),
                                            );
                                            toast("PDF downloaded");
                                          } catch {
                                            toast("Could not download PDF", "error");
                                          }
                                        }}
                                      >
                                        <Download className="size-3.5" />
                                        Download
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
                        pageSize={SLIP_PAGE}
                        total={filteredPayslips.length}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </>
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
      <SetupDrawer
        open={generateOpen}
        title="Generate slip"
        description="Select the payroll month. Slips are created for employees on that run."
        onClose={() => setGenerateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={!generateMonth || generating}
              onClick={() => void handleGeneratePayslips()}
            >
              {generating ? "Generating…" : "Generate"}
            </Button>
          </div>
        }
      >
        <SetupField label="Month" required>
          <SetupSelect value={generateMonth} onChange={(e) => setGenerateMonth(e.target.value)}>
            <option value="">Select month</option>
            {payrollMonths.map((m) => (
              <option key={m.month} value={m.month}>
                {m.label}
                {m.cycleLabel ? ` · ${m.cycleLabel}` : ""}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
      </SetupDrawer>
      <SetupDrawer
        open={Boolean(viewSlip)}
        wide
        title={viewSlip ? "Salary slip" : "Payslip"}
        description={
          viewSlip
            ? `${payslipEmployeeCode(viewSlip, employees) || viewSlip.employeeId} · ${viewSlip.monthLabel}`
            : undefined
        }
        onClose={() => setViewSlip(null)}
        footer={
          viewSlip ? (
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={async () => {
                try {
                  await downloadPayslipPdf(viewSlip, payslipPdfContext(viewSlip, employees));
                  toast("PDF downloaded");
                } catch {
                  toast("Could not download PDF", "error");
                }
              }}
            >
              <Download className="size-3.5" />
              Download PDF
            </Button>
          ) : null
        }
      >
        {viewSlip ? (
          <PayslipLetterhead slip={viewSlip} ctx={payslipPdfContext(viewSlip, employees)} />
        ) : null}
      </SetupDrawer>
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
    </div>
  );
}
