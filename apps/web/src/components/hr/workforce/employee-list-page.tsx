"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  Download,
  Eye,
  Pencil,
  Plus,
  SlidersHorizontal,
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
import {
  EMPLOYMENT_TYPE_FILTER_OPTIONS,
  formatEmploymentTypeLabel,
  GENDER_OPTIONS,
  LIFECYCLE_STATUS_OPTIONS,
} from "@/config/hr-master-options";
import {
  listEmploymentTypeOptions,
  listEntityOptions,
  type SetupMasterOption,
} from "@/services/hr-setup-service";

const PAGE_SIZE = 12;

const EMPTY_FILTERS: EmployeeListFilters = {
  branchId: "",
  entityId: "",
  departmentId: "",
  designation: "",
  employmentType: "",
  status: "",
  reportingManagerId: "",
  location: "",
  joiningFrom: "",
  gender: "",
};

const ADVANCED_FILTER_KEYS: (keyof EmployeeListFilters)[] = ["entityId", "gender"];

function countAdvancedFilters(filters: EmployeeListFilters): number {
  return ADVANCED_FILTER_KEYS.filter((key) => Boolean(filters[key])).length;
}

export function EmployeeManagementPage() {
  const router = useRouter();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [options, setOptions] = useState<EmployeeDirectoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EmployeeListFilters>(EMPTY_FILTERS);
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
  const [entityOptions, setEntityOptions] = useState<SetupMasterOption[]>([]);
  const [employmentTypeOptions, setEmploymentTypeOptions] = useState<SetupMasterOption[]>(
    EMPLOYMENT_TYPE_FILTER_OPTIONS,
  );
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ records: rows, options: opts, errors }, entities, employmentTypes] =
        await Promise.all([
          loadEmployeeDirectory(),
          listEntityOptions(),
          listEmploymentTypeOptions(),
        ]);
      setRecords(rows);
      setOptions(opts);
      setEntityOptions(entities);
      setEmploymentTypeOptions(employmentTypes);
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
  const stats = useMemo(() => computeEmployeeStats(records), [records]);
  const advancedFilterCount = useMemo(() => countAdvancedFilters(filters), [filters]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  useEffect(() => {
    if (advancedFilterCount > 0) setMoreFiltersOpen(true);
  }, [advancedFilterCount]);

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
                Add Employee
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
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !records.length ? (
        <EmsSkeleton />
      ) : (
        <>
          <HrKpiGrid
            activeKey={filters.status || "all"}
            onItemClick={(key) =>
              setFilters((f) => ({ ...f, status: key === "all" ? "" : key }))
            }
            items={[
              { key: "all", label: "Total Employees", value: stats.total },
              { key: "active", label: "Active Employees", value: stats.active },
              { key: "onboarding", label: "Pending Join", value: stats.onboarding },
              { key: "inactive", label: "Ex Employees", value: stats.inactive },
              { key: "probation", label: "Probation", value: stats.probation },
              { key: "notice", label: "Notice Period", value: stats.notice },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, email, phone…"
              className="h-8 w-full max-w-xs text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant={moreFiltersOpen ? "secondary" : "outline"}
              className="cursor-pointer h-8"
              onClick={() => setMoreFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="size-3.5" />
              More filters
              {advancedFilterCount > 0 ? (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {advancedFilterCount}
                </span>
              ) : null}
              <ChevronDown
                className={cn("size-3.5 transition-transform", moreFiltersOpen && "rotate-180")}
              />
            </Button>
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setMoreFiltersOpen(false);
              }}
            >
              Clear filters
            </button>
          </div>

          {moreFiltersOpen ? (
            <div className="flex flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
              <div className="w-44">
                <SetupField label="Entity">
                  <SetupSelect
                    className="h-8 text-xs"
                    value={filters.entityId}
                    onChange={(e) => setFilters((f) => ({ ...f, entityId: e.target.value }))}
                  >
                    <option value="">All entities</option>
                    {entityOptions.map((ent) => (
                      <option key={ent.value} value={ent.value}>
                        {ent.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
              </div>
              <div className="w-36">
                <SetupField label="Gender">
                  <SetupSelect
                    className="h-8 text-xs"
                    value={filters.gender}
                    onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">All</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </SetupSelect>
                </SetupField>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
              {selected.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-medium">{selected.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer h-7"
                    onClick={() =>
                      setConfirm({
                        title: "Activate Employees",
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
                        title: "Deactivate Employees",
                        message: "Set selected employees to ex-employee status?",
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
                        title: "Archive Employees",
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
                        Add Employee
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  <div className="erp-scroll max-h-[calc(100vh-18rem)] overflow-auto">
                    <table className="w-full min-w-[1200px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm">
                        <tr>
                          <th className="w-10 px-2 py-2 align-bottom">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                              onChange={(e) => toggleAll(e.target.checked)}
                            />
                          </th>
                          <HeaderFilterTh label="Employee" />
                          <HeaderFilterTh label="ID" />
                          <HeaderFilterTh label="Department">
                            <HeaderFilterSelect
                              value={filters.departmentId}
                              onChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))}
                              options={options?.departments.map((d) => ({ value: d.id, label: d.label })) ?? []}
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Designation">
                            <HeaderFilterSelect
                              value={filters.designation}
                              onChange={(v) => setFilters((f) => ({ ...f, designation: v }))}
                              options={[...new Set(records.map((r) => r.designationName))]
                                .filter(Boolean)
                                .map((d) => ({ value: d, label: d }))}
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Branch">
                            <HeaderFilterSelect
                              value={filters.branchId}
                              onChange={(v) =>
                                setFilters((f) => ({ ...f, branchId: v, location: "" }))
                              }
                              options={options?.branches.map((b) => ({ value: b.id, label: b.label })) ?? []}
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Location">
                            <HeaderFilterSelect
                              value={filters.location}
                              onChange={(v) => setFilters((f) => ({ ...f, location: v }))}
                              options={
                                options?.locations
                                  .filter((loc) => !filters.branchId || loc.branchId === filters.branchId)
                                  .map((loc) => ({ value: loc.id, label: loc.label })) ?? []
                              }
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Reporting Manager">
                            <HeaderFilterSelect
                              value={filters.reportingManagerId}
                              onChange={(v) => setFilters((f) => ({ ...f, reportingManagerId: v }))}
                              options={options?.managers.map((m) => ({ value: m.id, label: m.label })) ?? []}
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Type">
                            <HeaderFilterSelect
                              value={filters.employmentType}
                              onChange={(v) => setFilters((f) => ({ ...f, employmentType: v }))}
                              options={employmentTypeOptions.map((t) => ({
                                value: t.value,
                                label: t.label,
                              }))}
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Joined">
                            <Input
                              type="date"
                              className="h-7 w-full min-w-[110px] text-[10px]"
                              value={filters.joiningFrom}
                              onChange={(e) =>
                                setFilters((f) => ({ ...f, joiningFrom: e.target.value }))
                              }
                            />
                          </HeaderFilterTh>
                          <HeaderFilterTh label="Status">
                            <HeaderFilterSelect
                              value={filters.status}
                              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                              options={LIFECYCLE_STATUS_OPTIONS.map((s) => ({
                                value: s.value,
                                label: s.label,
                              }))}
                            />
                          </HeaderFilterTh>
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
                            <td className="px-2 py-2 text-xs">{row.locationName}</td>
                            <td className="px-2 py-2 text-xs">{row.reportingManagerName?.trim() || "—"}</td>
                            <td className="px-2 py-2 text-xs">{formatEmploymentTypeLabel(row.employmentType)}</td>
                            <td className="px-2 py-2 text-xs">{row.joiningDate || "—"}</td>
                            <td className="px-2 py-2">
                              <HrStatusBadge
                                status={
                                  row.lifecycleStatus === "onboarding"
                                    ? "Pending Join"
                                    : row.lifecycleStatus === "inactive"
                                      ? "Ex Employee"
                                      : row.lifecycleStatus
                                }
                              />
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
                                      title: "Archive Employee",
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

function HeaderFilterTh({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <th className="px-1.5 py-2 align-bottom">
      <div className="space-y-1">
        <span className="block whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {children ?? <span className="block h-7" />}
      </div>
    </th>
  );
}

function HeaderFilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <SetupSelect
      className={cn(
        "h-7 w-full min-w-[88px] max-w-[130px] cursor-pointer px-1.5 text-[10px]",
        value && "border-primary/40 bg-primary/5 font-medium",
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </SetupSelect>
  );
}
