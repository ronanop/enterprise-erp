"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { ApplyLeaveDrawer } from "@/components/hr/leave/apply-leave-drawer";
import { LeaveApprovalDrawer, LeaveTypePolicyPanel } from "@/components/hr/leave/leave-panels";
import { LeaveStatusBadge } from "@/components/hr/leave/leave-status-badge";
import {
  HrAuthBanner,
  HrEmptyState,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  computeLeaveStats,
  filterLeaveRequests,
  loadLeaveDirectory,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveFilters, LeaveRequestRecord } from "@/types/leave-management";
import { emptyLeaveFilters, LEAVE_STATUS_LABELS } from "@/types/leave-management";

const PAGE_SIZE = 12;

type Tab = "requests" | "types";

type StatCard = {
  label: string;
  value: number;
  href?: string;
};

export function LeaveManagementPage() {
  const searchParams = useSearchParams();
  const [dir, setDir] = useState<LeaveDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("requests");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LeaveFilters>(() => emptyLeaveFilters());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<LeaveRequestRecord | null>(null);

  const statusBucket = searchParams.get("status");
  const onLeaveTodayView = searchParams.get("view") === "on-leave-today";

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
      filterLeaveRequests(dir?.requests ?? [], query, filters, dir?.options.employees ?? [], {
        statusBucket: statusBucket || undefined,
        onLeaveToday: onLeaveTodayView,
      }),
    [dir, query, filters, statusBucket, onLeaveTodayView],
  );
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => setPage(1), [query, filters, tab, statusBucket, onLeaveTodayView]);

  const authBlocked = !isAuthenticated() && !loading && !dir?.requests.length;

  const statCards: StatCard[] = stats
    ? [
        { label: "Pending requests", value: stats.pending, href: "/hr/leave?status=pending" },
        { label: "Approved", value: stats.approved, href: "/hr/leave?status=approved" },
        { label: "Rejected", value: stats.rejected, href: "/hr/leave?status=rejected" },
        { label: "On leave today", value: stats.onLeaveToday, href: "/hr/leave?view=on-leave-today" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Leave Management"
        description="Review and approve employee leave requests."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setApplyOpen(true)}>
              <Plus className="size-3.5" />
              Apply leave
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !dir ? <EmsSkeleton /> : null}

      {statCards.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ label, value, href }) => {
            const active =
              (href?.includes("status=pending") && statusBucket === "pending") ||
              (href?.includes("status=approved") && statusBucket === "approved") ||
              (href?.includes("status=rejected") && statusBucket === "rejected") ||
              (href?.includes("view=on-leave-today") && onLeaveTodayView);
            const inner = (
              <>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-xl font-semibold">{value}</p>
              </>
            );
            if (!href) {
              return (
                <div
                  key={label}
                  className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "block cursor-pointer rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30",
                  active ? "border-primary/50 ring-1 ring-primary/20" : "border-border/70",
                )}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ) : null}

      {(statusBucket || onLeaveTodayView) && tab === "requests" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtered view:</span>
          <span className="font-medium text-foreground">
            {onLeaveTodayView
              ? "On leave today"
              : statusBucket
                ? `${statusBucket.charAt(0).toUpperCase()}${statusBucket.slice(1)}`
                : ""}
          </span>
          <Link href="/hr/leave" className="cursor-pointer text-primary hover:underline">
            Clear
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {(
          [
            ["requests", "Requests"],
            ["types", "Leave types"],
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
                            <LeaveStatusBadge status={row.extension.approvalStage || row.status} />
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

      {tab === "types" && dir ? (
        <LeaveTypePolicyPanel directory={dir} onSaved={() => void load()} />
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
    </div>
  );
}
