"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
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
import { emptyLeaveFilters } from "@/types/leave-management";

const PAGE_SIZE = 12;

type Tab = "requests" | "types";

type StatCard = {
  label: string;
  value: number;
  href?: string;
};

function FilterControl({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function LeaveManagementPage() {
  const searchParams = useSearchParams();
  const [dir, setDir] = useState<LeaveDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("requests");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LeaveFilters>(() => emptyLeaveFilters());
  const [page, setPage] = useState(1);
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
        { label: "Pending Requests", value: stats.pending, href: "/hr/leave?status=pending" },
        { label: "Approved", value: stats.approved, href: "/hr/leave?status=approved" },
        { label: "Rejected", value: stats.rejected, href: "/hr/leave?status=rejected" },
        { label: "On Leave Today", value: stats.onLeaveToday, href: "/hr/leave?view=on-leave-today" },
      ]
    : [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <SetupToastHost />
      <PageHeader
        title="Leave Management"
        description="Review and approve employee leave requests."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setApplyOpen(true)}>
              <Plus className="size-3.5" />
              Apply Leave
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}
      {loading && !dir ? <EmsSkeleton /> : null}

      {statCards.length ? (
        <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ label, value, href }) => {
            const active =
              (href?.includes("status=pending") && statusBucket === "pending") ||
              (href?.includes("status=approved") && statusBucket === "approved") ||
              (href?.includes("status=rejected") && statusBucket === "rejected") ||
              (href?.includes("view=on-leave-today") && onLeaveTodayView);
            const inner = (
              <>
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {label}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
              </>
            );
            if (!href) {
              return (
                <div
                  key={label}
                  className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm"
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
                  "block cursor-pointer rounded-lg border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30",
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
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span>Filtered view:</span>
          <span className="font-medium text-foreground">
            {onLeaveTodayView
              ? "On Leave Today"
              : statusBucket
                ? `${statusBucket.charAt(0).toUpperCase()}${statusBucket.slice(1)}`
                : ""}
          </span>
          <Link href="/hr/leave" className="cursor-pointer text-primary hover:underline">
            Clear
          </Link>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1 border-b border-border/60">
        {(
          [
            ["requests", "Requests"],
            ["types", "Leave Types"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "cursor-pointer border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="shrink-0 rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground">Filter Requests</p>
              <button
                type="button"
                className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
                onClick={() => {
                  setFilters(emptyLeaveFilters());
                  setQuery("");
                }}
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
              <FilterControl label="Search" className="col-span-2">
                <Input
                  className="h-8"
                  placeholder="Name, ID, department…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </FilterControl>
              <FilterControl label="Branch">
                <FilterSelect
                  value={filters.branchId}
                  onChange={(branchId) => setFilters((f) => ({ ...f, branchId }))}
                  options={[
                    { value: "", label: "All" },
                    ...(dir?.options.branches.map((b) => ({ value: b.id, label: b.label })) ?? []),
                  ]}
                />
              </FilterControl>
              <FilterControl label="Department">
                <FilterSelect
                  value={filters.departmentId}
                  onChange={(departmentId) => setFilters((f) => ({ ...f, departmentId }))}
                  options={[
                    { value: "", label: "All" },
                    ...(dir?.options.departments.map((d) => ({ value: d.id, label: d.label })) ?? []),
                  ]}
                />
              </FilterControl>
              <FilterControl label="Leave Type">
                <FilterSelect
                  value={filters.leaveTypeId}
                  onChange={(leaveTypeId) => setFilters((f) => ({ ...f, leaveTypeId }))}
                  options={[
                    { value: "", label: "All" },
                    ...(dir?.options.leaveTypes.map((t) => ({ value: t.id, label: t.label })) ?? []),
                  ]}
                />
              </FilterControl>
              <FilterControl label="Status">
                <FilterSelect
                  value={filters.status}
                  onChange={(status) => setFilters((f) => ({ ...f, status }))}
                  options={[
                    { value: "", label: "All" },
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
              </FilterControl>
              <FilterControl label="Manager">
                <FilterSelect
                  value={filters.managerId}
                  onChange={(managerId) => setFilters((f) => ({ ...f, managerId }))}
                  options={[
                    { value: "", label: "All" },
                    ...(dir?.options.managers.map((m) => ({ value: m.id, label: m.label })) ?? []),
                  ]}
                />
              </FilterControl>
              <FilterControl label="From">
                <Input
                  type="date"
                  className="h-8"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </FilterControl>
              <FilterControl label="To">
                <Input
                  type="date"
                  className="h-8"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </FilterControl>
            </div>
          </div>

          {!pageRows.length ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-card/40">
              <HrEmptyState
                title="No Leave Requests"
                description="Apply Leave to create the first request with policy validation."
                action={
                  <Button size="sm" className="cursor-pointer" onClick={() => setApplyOpen(true)}>
                    Apply Leave
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                <div className="erp-scroll min-h-0 flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Employee
                        </th>
                        <th className="w-[76px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          ID
                        </th>
                        {!approvalRequest ? (
                          <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Department
                          </th>
                        ) : null}
                        <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Leave Type
                        </th>
                        <th className="w-[96px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          From
                        </th>
                        <th className="w-[96px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          To
                        </th>
                        <th className="w-12 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Days
                        </th>
                        {!approvalRequest ? (
                          <th className="w-[96px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Applied
                          </th>
                        ) : null}
                        <th className="w-[96px] px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Status
                        </th>
                        {!approvalRequest ? (
                          <th className="px-3 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Approver
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => {
                        const isOpen = approvalRequest?.id === row.id;
                        return (
                          <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "border-b border-border/40 cursor-pointer transition-colors",
                              isOpen
                                ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                                : "odd:bg-background even:bg-muted/20 hover:bg-muted/40",
                            )}
                            onClick={() => setApprovalRequest(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setApprovalRequest(row);
                              }
                            }}
                          >
                            <td className="truncate px-3 py-2 text-xs font-medium text-primary">
                              {row.employeeName}
                            </td>
                            <td className="truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                              {row.employeeCode}
                            </td>
                            {!approvalRequest ? (
                              <td className="truncate px-3 py-2 text-xs text-muted-foreground">
                                {row.departmentName}
                              </td>
                            ) : null}
                            <td className="px-3 py-2 text-xs">
                              <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: row.extension.color }}
                                />
                                <span className="truncate">{row.leaveTypeName}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                              {row.fromDate}
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                              {row.toDate}
                            </td>
                            <td className="px-3 py-2 text-xs tabular-nums">{row.totalDays}</td>
                            {!approvalRequest ? (
                              <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                                {row.appliedOn.slice(0, 10)}
                              </td>
                            ) : null}
                            <td className="px-3 py-2">
                              <LeaveStatusBadge
                                status={row.extension.approvalStage || row.status}
                              />
                            </td>
                            {!approvalRequest ? (
                              <td className="truncate px-3 py-2 text-xs text-muted-foreground">
                                {row.approverName}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <EmsPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </div>

              {approvalRequest ? (
                <div className="flex min-h-[22rem] w-full shrink-0 self-stretch lg:min-h-0 lg:w-auto">
                  <LeaveApprovalDrawer
                    open
                    request={approvalRequest}
                    onClose={() => setApprovalRequest(null)}
                    onDone={() => void load()}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === "types" && dir ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <LeaveTypePolicyPanel directory={dir} onSaved={() => void load()} />
        </div>
      ) : null}

      <ApplyLeaveDrawer
        open={applyOpen}
        directory={dir}
        onClose={() => setApplyOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
