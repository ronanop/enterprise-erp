"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  UserCheck,
  UserMinus,
} from "lucide-react";

import {
  EmsAvatar,
  EmsPagination,
  EmsSkeleton,
} from "@/components/hr/workforce/ems-primitives";
import { EmployeeImportDrawer } from "@/components/hr/workforce/employee-import-drawer";
import {
  HrAuthBanner,
  HrEmptyState,
  HrKpiGrid,
  HrStatusBadge,
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { isAuthenticated } from "@/lib/auth";
import {
  bulkUpdateEmployees,
  computeEmployeeStats,
  downloadTextFile,
  exportEmployeesCsv,
  filterEmployees,
  loadEmployeeDirectory,
  setEmployeeLifecycleStatus,
  type EmployeeDirectoryOptions,
} from "@/services/employee-management-service";
import type { EmployeeListFilters, EmployeeRecord } from "@/types/employee-management";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const EMPTY_FILTERS: EmployeeListFilters = {
  branchId: "",
  departmentId: "",
  designation: "",
  employmentType: "",
  status: "",
  reportingManagerId: "",
  location: "",
  joiningFrom: "",
  joiningTo: "",
  gender: "",
};

export function EmployeeManagementPage() {
  const router = useRouter();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [options, setOptions] = useState<EmployeeDirectoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EmployeeListFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { records: rows, options: opts, errors } = await loadEmployeeDirectory();
      setRecords(rows);
      setOptions(opts);
      if (errors.length) toast(errors.join(" · "), "info");
    } catch {
      toast("Failed to load employee directory", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterEmployees(records, query, filters),
    [records, query, filters],
  );
  const stats = useMemo(() => computeEmployeeStats(filtered), [filtered]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  const authBlocked = !isAuthenticated() && !loading && records.length === 0;

  const selectedRecords = useMemo(
    () => records.filter((r) => selected.has(r.id)),
    [records, selected],
  );

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(pageRows.map((r) => r.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(status: EmployeeRecord["lifecycleStatus"], title: string) {
    if (!selectedRecords.length) return;
    await Promise.all(selectedRecords.map((r) => setEmployeeLifecycleStatus(r, status, title)));
    toast(`${title} — ${selectedRecords.length} employee(s)`, "success");
    setSelected(new Set());
    void load();
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Employee Management"
        description="Manage employee profiles, employment records, documents, and lifecycle."
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Link href="/hr/workforce/new">
              <Button size="sm" className="cursor-pointer">
                <Plus className="size-3.5" />
                Add employee
              </Button>
            </Link>
            <Link href="/hr/onboarding">
              <Button size="sm" variant="outline" className="cursor-pointer">
                Onboarding
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `employees-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportEmployeesCsv(filtered),
                  "text/csv",
                );
                toast("Export downloaded (CSV)", "success");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => void load()}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !records.length ? (
        <EmsSkeleton />
      ) : (
        <>
          <HrKpiGrid
            items={[
              { label: "Total employees", value: stats.total },
              { label: "Active", value: stats.active },
              { label: "Inactive", value: stats.inactive },
              { label: "Probation", value: stats.probation },
              { label: "Notice period", value: stats.notice },
            ]}
          />

          <div className="flex flex-col gap-3 lg:flex-row">
            <aside
              className={cn(
                "lg:w-64 lg:shrink-0",
                filtersOpen ? "block" : "hidden lg:block",
              )}
            >
              <div className="sticky top-4 space-y-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Filters
                  </h3>
                  <button
                    type="button"
                    className="cursor-pointer text-[10px] text-primary hover:underline"
                    onClick={() => setFilters(EMPTY_FILTERS)}
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
                    {options?.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Department">
                  <SetupSelect
                    value={filters.departmentId}
                    onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                  >
                    <option value="">All</option>
                    {options?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Designation">
                  <SetupSelect
                    value={filters.designation}
                    onChange={(e) => setFilters((f) => ({ ...f, designation: e.target.value }))}
                  >
                    <option value="">All</option>
                    {[...new Set(records.map((r) => r.designationName))].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Employment type">
                  <SetupSelect
                    value={filters.employmentType}
                    onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}
                  >
                    <option value="">All</option>
                    {["permanent", "contract", "intern", "consultant"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Status">
                  <SetupSelect
                    value={filters.status}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">All</option>
                    {["active", "inactive", "probation", "notice", "resigned", "archived"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Reporting manager">
                  <SetupSelect
                    value={filters.reportingManagerId}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, reportingManagerId: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {options?.managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Gender">
                  <SetupSelect
                    value={filters.gender}
                    onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">All</option>
                    {["male", "female", "other", "prefer_not_to_say"].map((g) => (
                      <option key={g} value={g}>
                        {g.replace(/_/g, " ")}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
                <SetupField label="Joining from">
                  <Input
                    type="date"
                    value={filters.joiningFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, joiningFrom: e.target.value }))}
                  />
                </SetupField>
                <SetupField label="Joining to">
                  <Input
                    type="date"
                    value={filters.joiningTo}
                    onChange={(e) => setFilters((f) => ({ ...f, joiningTo: e.target.value }))}
                  />
                </SetupField>
              </div>
            </aside>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID, email, phone, department, designation…"
                  className="max-w-md flex-1"
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
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-medium">{selected.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer h-7"
                    onClick={() =>
                      setConfirm({
                        title: "Activate employees",
                        message: "Set selected employees to active status?",
                        action: () => runBulk("active", "Activated"),
                      })
                    }
                  >
                    <UserCheck className="size-3" />
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer h-7"
                    onClick={() =>
                      setConfirm({
                        title: "Deactivate employees",
                        message: "Set selected employees to inactive?",
                        action: () => runBulk("inactive", "Deactivated"),
                      })
                    }
                  >
                    <UserMinus className="size-3" />
                    Deactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer h-7"
                    onClick={() =>
                      setConfirm({
                        title: "Archive employees",
                        message: "Soft-archive selected employees? Records are retained.",
                        action: () => runBulk("archived", "Archived"),
                      })
                    }
                  >
                    <Archive className="size-3" />
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer h-7"
                    onClick={() => {
                      downloadTextFile("employees-selected.csv", exportEmployeesCsv(selectedRecords), "text/csv");
                      toast("Exported selected rows", "success");
                    }}
                  >
                    Export
                  </Button>
                </div>
              ) : null}

              {!pageRows.length ? (
                <HrEmptyState
                  title="No employees match"
                  description="Adjust filters or add a new employee with the guided wizard."
                  action={
                    <Link href="/hr/workforce/new">
                      <Button size="sm" className="cursor-pointer">
                        Add employee
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  <div className="erp-scroll max-h-[calc(100vh-18rem)] overflow-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/90 backdrop-blur-sm">
                        <tr>
                          <th className="w-10 px-2 py-2">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                              onChange={(e) => toggleAll(e.target.checked)}
                            />
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Employee
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            ID
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Department
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Designation
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Branch
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Reporting manager
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Type
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Joined
                          </th>
                          <th className="px-2 py-2 text-[11px] font-medium uppercase text-muted-foreground">
                            Status
                          </th>
                          <th className="w-12 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                          >
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={selected.has(row.id)}
                                onChange={() => toggleOne(row.id)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Link
                                href={`/hr/workforce/${row.id}`}
                                className="flex cursor-pointer items-center gap-2 hover:text-primary"
                              >
                                <EmsAvatar name={row.displayName} photoUrl={row.profilePhotoDataUrl} size="sm" />
                                <span className="font-medium">{row.displayName}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                              {row.employeeCode}
                            </td>
                            <td className="px-2 py-2 text-xs">{row.departmentName}</td>
                            <td className="px-2 py-2 text-xs">{row.designationName}</td>
                            <td className="px-2 py-2 text-xs">{row.branchName}</td>
                            <td className="px-2 py-2 text-xs">{row.reportingManagerName}</td>
                            <td className="px-2 py-2 text-xs capitalize">{row.employmentType}</td>
                            <td className="px-2 py-2 text-xs">{row.joiningDate || "—"}</td>
                            <td className="px-2 py-2">
                              <HrStatusBadge status={row.lifecycleStatus} />
                            </td>
                            <td className="px-2 py-2">
                              <RowActionsMenu
                                open={menuId === row.id}
                                onOpenChange={(open) => setMenuId(open ? row.id : null)}
                              >
                                <RowActionsItem
                                  onClick={() => {
                                    setMenuId(null);
                                    router.push(`/hr/workforce/${row.id}`);
                                  }}
                                >
                                  <Eye className="size-3.5 text-muted-foreground" />
                                  View
                                </RowActionsItem>
                                <RowActionsItem
                                  onClick={() => {
                                    setMenuId(null);
                                    router.push(`/hr/workforce/${row.id}?edit=1`);
                                  }}
                                >
                                  <Pencil className="size-3.5 text-muted-foreground" />
                                  Edit
                                </RowActionsItem>
                                <RowActionsItem
                                  onClick={() => {
                                    setMenuId(null);
                                    void setEmployeeLifecycleStatus(row, "inactive", "Deactivated").then(
                                      load,
                                    );
                                  }}
                                >
                                  <UserMinus className="size-3.5 text-muted-foreground" />
                                  Deactivate
                                </RowActionsItem>
                                <RowActionsItem
                                  destructive
                                  onClick={() => {
                                    setConfirm({
                                      title: "Archive employee",
                                      message:
                                        "Soft delete — status becomes archived. Record is retained.",
                                      action: async () => {
                                        await setEmployeeLifecycleStatus(row, "archived", "Archived");
                                        await load();
                                      },
                                    });
                                    setMenuId(null);
                                  }}
                                >
                                  <Archive className="size-3.5" />
                                  Delete
                                </RowActionsItem>
                              </RowActionsMenu>
                            </td>
                          </tr>
                        ))}
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
              )}
            </div>
          </div>
        </>
      )}

      <EmployeeImportDrawer open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void load()} />

      <SetupConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        destructive={confirm?.title.toLowerCase().includes("archive") || confirm?.title.toLowerCase().includes("delete")}
        loading={confirmLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          setConfirmLoading(true);
          void confirm.action().finally(() => {
            setConfirmLoading(false);
            setConfirm(null);
          });
        }}
      />
    </div>
  );
}
