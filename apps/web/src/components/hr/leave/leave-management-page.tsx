"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Plus,
  Scale,
  Upload,
  Wallet,
} from "lucide-react";

import { ApplyLeaveDrawer } from "@/components/hr/leave/apply-leave-drawer";
import { LeaveCalendarView } from "@/components/hr/leave/leave-calendar";
import {
  CompOffEncashDrawers,
  LeaveApprovalDrawer,
  LeaveBalancePanel,
  LeaveReportsPanel,
  LeaveTypePolicyPanel,
} from "@/components/hr/leave/leave-panels";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  computeLeaveStats,
  deriveLeaveAudit,
  downloadTextFile,
  exportLeaveCsv,
  filterLeaveRequests,
  loadLeaveDirectory,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveFilters, LeaveRequestRecord } from "@/types/leave-management";
import { emptyLeaveFilters, LEAVE_STATUS_LABELS } from "@/types/leave-management";

const PAGE_SIZE = 12;

type Tab =
  | "requests"
  | "calendar"
  | "balances"
  | "types"
  | "reports"
  | "policies"
  | "audit";

export function LeaveManagementPage() {
  const [dir, setDir] = useState<LeaveDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("requests");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LeaveFilters>(() => emptyLeaveFilters());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<LeaveRequestRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDir(await loadLeaveDirectory());
    } catch {
      toast("Failed to load leave data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => (dir ? computeLeaveStats(dir) : null), [dir]);
  const filtered = useMemo(
    () =>
      filterLeaveRequests(dir?.requests ?? [], query, filters, dir?.options.employees ?? []),
    [dir, query, filters],
  );
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => setPage(1), [query, filters, tab]);

  const audit = useMemo(() => deriveLeaveAudit(dir), [dir, tab]);
  const authBlocked = !isAuthenticated() && !loading && !dir?.requests.length;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Leave Management"
        description="Manage employee leave requests, balances, approvals, and leave policies."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setApplyOpen(true)}>
              <Plus className="size-3.5" />
              Apply leave
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setTab("calendar")}>
              <CalendarDays className="size-3.5" />
              Leave calendar
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setTab("balances")}>
              <Wallet className="size-3.5" />
              Leave balance
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setTab("reports")}>
              <Scale className="size-3.5" />
              Leave reports
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportLeaveCsv(filtered),
                  "text/csv",
                );
                toast("CSV exported", "success");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !dir ? <EmsSkeleton /> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {[
            ["Pending requests", stats.pending],
            ["Approved", stats.approved],
            ["Rejected", stats.rejected],
            ["On leave today", stats.onLeaveToday],
            ["Balance remaining", Math.round(stats.balanceRemaining)],
            ["Upcoming holidays", stats.upcomingHolidays],
            ["Carry forward", stats.carryForward],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {(
          [
            ["requests", "Requests"],
            ["calendar", "Calendar"],
            ["balances", "Balances"],
            ["types", "Leave types"],
            ["policies", "Comp-off & encash"],
            ["reports", "Reports"],
            ["audit", "Audit log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <div className="flex flex-col gap-3 lg:flex-row">
          <aside className={cn("lg:w-60 shrink-0", filtersOpen ? "block" : "hidden lg:block")}>
            <div className="sticky top-4 space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Filters</span>
                <button
                  type="button"
                  className="cursor-pointer text-[10px] text-primary"
                  onClick={() => setFilters(emptyLeaveFilters())}
                >
                  Clear
                </button>
              </div>
              <SetupField label="Branch">
                <SetupSelect
                  value={filters.branchId}
                  onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}
                >
                  <option value="">All</option>
                  {dir?.options.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Department">
                <SetupSelect
                  value={filters.departmentId}
                  onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">All</option>
                  {dir?.options.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Leave type">
                <SetupSelect
                  value={filters.leaveTypeId}
                  onChange={(e) => setFilters((f) => ({ ...f, leaveTypeId: e.target.value }))}
                >
                  <option value="">All</option>
                  {dir?.options.leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Status">
                <SetupSelect
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All</option>
                  {Object.entries(LEAVE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Reporting manager">
                <SetupSelect
                  value={filters.managerId}
                  onChange={(e) => setFilters((f) => ({ ...f, managerId: e.target.value }))}
                >
                  <option value="">All</option>
                  {dir?.options.managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="From">
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </SetupField>
              <SetupField label="To">
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </SetupField>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-md flex-1"
                placeholder="Search name, employee ID, department…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer lg:hidden"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                Filters
              </Button>
            </div>

            {selected.size > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <span className="font-medium">{selected.size} selected</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer h-7"
                  onClick={() => {
                    downloadTextFile(
                      "leave-selected.csv",
                      exportLeaveCsv(filtered.filter((r) => selected.has(r.id))),
                      "text/csv",
                    );
                  }}
                >
                  Export selected
                </Button>
              </div>
            ) : null}

            {!pageRows.length ? (
              <HrEmptyState
                title="No leave requests"
                description="Apply leave to create the first request with policy validation."
                action={
                  <Button size="sm" className="cursor-pointer" onClick={() => setApplyOpen(true)}>
                    Apply leave
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                <div className="erp-scroll max-h-[calc(100vh-20rem)] overflow-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/90 backdrop-blur-sm">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                            onChange={(e) => {
                              if (e.target.checked) setSelected(new Set(pageRows.map((r) => r.id)));
                              else setSelected(new Set());
                            }}
                          />
                        </th>
                        {[
                          "Employee",
                          "ID",
                          "Department",
                          "Leave type",
                          "From",
                          "To",
                          "Days",
                          "Applied",
                          "Status",
                          "Approver",
                          "",
                        ].map((h) => (
                          <th key={h || "a"} className="px-2 py-2 text-[10px] font-medium uppercase text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={selected.has(row.id)}
                              onChange={() => {
                                setSelected((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(row.id)) n.delete(row.id);
                                  else n.add(row.id);
                                  return n;
                                });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 text-xs font-medium">{row.employeeName}</td>
                          <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{row.employeeCode}</td>
                          <td className="px-2 py-2 text-xs">{row.departmentName}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: row.extension.color }}
                              />
                              {row.leaveTypeName}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs">{row.fromDate}</td>
                          <td className="px-2 py-2 text-xs">{row.toDate}</td>
                          <td className="px-2 py-2 text-xs">{row.totalDays}</td>
                          <td className="px-2 py-2 text-xs">{row.appliedOn.slice(0, 10)}</td>
                          <td className="px-2 py-2">
                            <HrStatusBadge status={row.extension.approvalStage || row.status} />
                          </td>
                          <td className="px-2 py-2 text-xs">{row.approverName}</td>
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer h-7 text-xs"
                              onClick={() => setApprovalRequest(row)}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <EmsPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "calendar" && dir ? (
        <LeaveCalendarView directory={dir} onSelectRequest={setApprovalRequest} />
      ) : null}

      {tab === "balances" && dir ? <LeaveBalancePanel directory={dir} onSaved={() => void load()} /> : null}

      {tab === "types" && dir ? (
        <LeaveTypePolicyPanel directory={dir} onSaved={() => void load()} />
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-4">
          <CompOffEncashDrawers directory={dir} onDone={() => void load()} />
          {dir ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Comp offs</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {dir.compOffs.map((c) => (
                    <li key={c.id} className="rounded border border-border/50 px-2 py-1.5">
                      {c.employeeName} · {c.days}d · {c.status} · exp {c.expiryDate}
                    </li>
                  ))}
                  {!dir.compOffs.length ? <li className="text-muted-foreground">None yet</li> : null}
                </ul>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Encashments</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {dir.encashments.map((e) => (
                    <li key={e.id} className="rounded border border-border/50 px-2 py-1.5">
                      {e.employeeName} · {e.requestedDays}d · ₹{e.amount} · {e.status}
                    </li>
                  ))}
                  {!dir.encashments.length ? <li className="text-muted-foreground">None yet</li> : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "reports" && dir ? <LeaveReportsPanel directory={dir} /> : null}

      {tab === "audit" ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Audit trail</h3>
              <p className="text-[11px] text-muted-foreground">
                Leave applications, approvals, and policy changes ({audit.length} entries).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                const csv = [
                  "Action,Detail,Who,When",
                  ...audit.map(
                    (a) =>
                      `"${a.action}","${String(a.detail).replace(/"/g, '""')}","${a.actor}","${a.at}"`,
                  ),
                ].join("\n");
                downloadTextFile(
                  `leave-audit-${new Date().toISOString().slice(0, 10)}.csv`,
                  csv,
                  "text/csv",
                );
                toast("Audit CSV exported", "success");
              }}
            >
              <Download className="size-3.5" />
              Export audit
            </Button>
          </div>
          {!audit.length ? (
            <HrEmptyState
              title="No audit entries"
              description="Apply leave, approve requests, or edit leave type policies to populate the audit log."
            />
          ) : (
            <div className="erp-scroll mt-3 max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Action</th>
                    <th className="py-2">Detail</th>
                    <th className="py-2">Who</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 100).map((a) => (
                    <tr key={a.id} className="border-b border-border/40">
                      <td className="py-2 font-medium capitalize">{a.action.replace(/_/g, " ")}</td>
                      <td className="py-2 text-muted-foreground">{a.detail}</td>
                      <td className="py-2">{a.actor}</td>
                      <td className="py-2">{new Date(a.at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ApplyLeaveDrawer
        open={applyOpen}
        directory={dir}
        onClose={() => setApplyOpen(false)}
        onSaved={() => void load()}
      />
      <LeaveApprovalDrawer
        open={Boolean(approvalRequest)}
        request={approvalRequest}
        onClose={() => setApprovalRequest(null)}
        onDone={() => void load()}
      />

      <SetupDrawer
        open={importOpen}
        title="Import leave"
        description="Import leave balances or requests (CSV)."
        onClose={() => setImportOpen(false)}
      >
        <SetupField label="Upload file">
          <input type="file" accept=".csv,.xlsx" className="cursor-pointer text-xs" />
        </SetupField>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 cursor-pointer"
          onClick={() => {
            downloadTextFile(
              "leave-import-sample.csv",
              "employee_code,leave_type_code,from_date,to_date,days,reason\nEMP-000001,CL,2026-08-01,2026-08-02,2,Personal",
              "text/csv",
            );
          }}
        >
          Download sample template
        </Button>
      </SetupDrawer>

      <p className="text-[10px] text-muted-foreground">
        RBAC: hr.leave:*, hr.leave_type:* · Notifications to employee / manager / HR via platform notification engine when wired.
      </p>
    </div>
  );
}
