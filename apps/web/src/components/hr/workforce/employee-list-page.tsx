"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Columns3,
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
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
  HrToolbar,
} from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { isAuthenticated } from "@/lib/auth";
import {
  EXACT_CASE_HEADER_COLUMNS,
  excelEntityCell,
  excelOrganisationCell,
  renderEmployeeCell,
} from "@/lib/employee-table-columns";
import {
  ALL_EMPLOYEE_TABLE_COLUMN_KEYS,
  EMPLOYEE_TABLE_COLUMN_LABELS,
  EXCEL_EMPLOYEE_TABLE_COLUMNS,
  EXTRA_EMPLOYEE_TABLE_COLUMNS,
  REQUIRED_EMPLOYEE_TABLE_COLUMNS,
  useEmployeeTablePrefs,
  type EmployeeTableColumnKey,
} from "@/hooks/use-employee-table-prefs";
import { FilterSelect } from "@/components/ui/filter-select";

/** Keep header and body cells on the same grid (avoids Excel-field column drift). */
const COLUMN_CELL_CLASS: Partial<Record<EmployeeTableColumnKey, string>> = {
  employeeCode: "min-w-[7.5rem] max-w-[9rem]",
  name: "min-w-[11rem] max-w-[14rem]",
  entity: "min-w-[8rem] max-w-[11rem]",
  organisation: "min-w-[7rem] max-w-[10rem]",
  location: "min-w-[7rem] max-w-[10rem]",
  designation: "min-w-[8rem] max-w-[11rem]",
  department: "min-w-[8rem] max-w-[11rem]",
  reportingManager: "min-w-[8rem] max-w-[11rem]",
  phone: "min-w-[7.5rem] max-w-[9rem]",
  personalEmail: "min-w-[10rem] max-w-[14rem]",
  email: "min-w-[10rem] max-w-[14rem]",
  gender: "min-w-[4.5rem]",
  dob: "min-w-[6rem]",
  joiningDate: "min-w-[6rem]",
  emergencyName: "min-w-[8rem] max-w-[11rem]",
  emergencyRelation: "min-w-[5.5rem]",
  emergencyPhone: "min-w-[7.5rem] max-w-[9rem]",
  fatherName: "min-w-[7rem] max-w-[10rem]",
  esi: "min-w-[5rem]",
  status: "min-w-[5.5rem]",
};
import {
  computeEmployeeStats,
  downloadTextFile,
  EMPLOYEE_LIST_PAGE_SIZE,
  exportEmployeesCsv,
  filterEmployees,
  listEmployeesPage,
  loadEmployeeDirectory,
  setEmployeeLifecycleStatus,
  type EmployeeDirectoryOptions,
} from "@/services/employee-management-service";
import type { EmployeeListFilters, EmployeeRecord } from "@/types/employee-management";
import { cn } from "@/lib/utils";

const EMPTY_FILTERS: EmployeeListFilters = {
  branchId: "",
  entityId: "",
  organisation: "",
  departmentId: "",
  designation: "",
  employmentType: "",
  status: "",
  reportingManagerId: "",
  location: "",
  joiningFrom: "",
  gender: "",
  workforceScope: "",
};

const HEADER_FILTER_COLUMNS = new Set<EmployeeTableColumnKey>([
  "entity",
  "organisation",
  "location",
  "designation",
  "department",
  "reportingManager",
  "gender",
  "status",
  "employmentType",
  "branch",
]);

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((v) => v.trim()).filter((v) => v && v !== "-"))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function EmployeeManagementPage() {
  const router = useRouter();
  const { prefs, toggleColumn, resetColumns } = useEmployeeTablePrefs();
  const visibleColumns = useMemo(
    () => new Set(prefs.visibleColumns),
    [prefs.visibleColumns],
  );
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [options, setOptions] = useState<EmployeeDirectoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EmployeeListFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [earlyCompanies, setEarlyCompanies] = useState<{ id: string; label: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setDirectoryReady(false);
    setPage(1);
    try {
      const first = await listEmployeesPage(1, EMPLOYEE_LIST_PAGE_SIZE);
      setRecords(first.records);
      setLoading(false);

      const { records: rows, options: opts, errors } = await loadEmployeeDirectory();
      // Existing office employees → office_staff so client-side imports can use other tags.
      let tagged = rows;
      let nextOpts = opts;
      try {
        const { backfillOfficeStaffTags, stampLocalOfficeStaffTags } = await import(
          "@/services/employee-import-service"
        );
        stampLocalOfficeStaffTags();
        const result = await backfillOfficeStaffTags();
        if (Number(result.updated || 0) > 0) {
          const refreshed = await loadEmployeeDirectory();
          tagged = refreshed.records;
          nextOpts = refreshed.options;
        } else {
          tagged = rows.map((r) => {
            const tags = r.tags?.length
              ? r.tags
              : r.extension?.tags?.length
                ? r.extension.tags
                : ["office_staff"];
            return { ...r, tags, extension: { ...r.extension, tags } };
          });
        }
      } catch {
        tagged = rows.map((r) => {
          const tags = r.tags?.length
            ? r.tags
            : r.extension?.tags?.length
              ? r.extension.tags
              : ["office_staff"];
          return { ...r, tags, extension: { ...r.extension, tags } };
        });
      }
      setRecords(tagged);
      setOptions(nextOpts);
      setDirectoryReady(true);
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

  useEffect(() => {
    let cancelled = false;
    void import("@/services/api-client")
      .then(({ contextService }) => contextService.listCompanies())
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setEarlyCompanies(
          rows
            .map((c) => ({
              id: String(c.id ?? ""),
              label: String(c.company_name ?? "").trim(),
            }))
            .filter((c) => c.id && c.label)
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {
        /* directory options still populate later */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entityOptions = useMemo(() => {
    const fromCompanies = (options?.companies ?? []).map((c) => ({
      id: c.id,
      label: c.label,
    }));
    if (fromCompanies.length) return fromCompanies;
    if (earlyCompanies.length) return earlyCompanies;
    const byId = new Map<string, string>();
    for (const r of records) {
      const id = r.companyId || r.extension.employment.entityId;
      const label = excelEntityCell(r);
      if (id && label && label !== "-") byId.set(id, label);
    }
    return [...byId.entries()].map(([id, label]) => ({ id, label }));
  }, [options?.companies, earlyCompanies, records]);

  const entityLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entityOptions) map.set(e.id, e.label);
    return map;
  }, [entityOptions]);

  const filtered = useMemo(
    () => filterEmployees(records, query, filters, { entityLabelById }),
    [records, query, filters, entityLabelById],
  );
  const stats = useMemo(() => computeEmployeeStats(records), [records]);

  const headerFilterOptions = useMemo(() => {
    const orgs = uniqueSorted(records.map((r) => excelOrganisationCell(r)));
    const locations = uniqueSorted(
      records.map((r) => r.locationName || r.extension.employment.location || ""),
    );
    const designations = uniqueSorted(
      (options?.designations ?? []).map((d) => d.label).concat(records.map((r) => r.designationName)),
    );
    const departments = (options?.departments ?? []).map((d) => ({ value: d.id, label: d.label }));
    const deptFallback = uniqueSorted(records.map((r) => r.departmentName)).map((label) => {
      const hit = records.find((r) => r.departmentName === label);
      return { value: hit?.departmentId || label, label };
    });
    const managers = (options?.managers?.length ? options.managers : options?.employees ?? []).map(
      (m) => ({
        value: m.id,
        label: m.label,
      }),
    );
    const managerFallback = uniqueSorted(records.map((r) => r.reportingManagerName || "")).map(
      (label) => {
        const hit = records.find((r) => r.reportingManagerName === label);
        return { value: hit?.reportingManagerId || label, label };
      },
    );
    const branches = (options?.branches ?? []).map((b) => ({ value: b.id, label: b.label }));
    return {
      organisations: orgs.map((label) => ({ value: label, label })),
      locations: locations.map((label) => ({ value: label, label })),
      designations: designations.map((label) => ({ value: label, label })),
      departments: departments.length ? departments : deptFallback,
      managers: managers.length ? managers : managerFallback,
      branches,
      genders: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
        { value: "other", label: "Other" },
      ],
      statuses: [
        { value: "active", label: "Active" },
        { value: "onboarding", label: "Pending Join" },
        { value: "probation", label: "Probation" },
        { value: "notice", label: "Notice Period" },
        { value: "resigned", label: "Resigned" },
        { value: "inactive", label: "Ex Employee" },
      ],
      employmentTypes: uniqueSorted(records.map((r) => r.employmentType || "")).map((value) => ({
        value,
        label: value,
      })),
    };
  }, [records, options]);

  const filtersActive = Boolean(
    query ||
      filters.entityId ||
      filters.organisation ||
      filters.departmentId ||
      filters.designation ||
      filters.employmentType ||
      filters.status ||
      filters.reportingManagerId ||
      filters.location ||
      filters.gender ||
      filters.branchId ||
      filters.joiningFrom ||
      filters.workforceScope,
  );

  function headerFilterValue(key: EmployeeTableColumnKey): string {
    switch (key) {
      case "entity":
        return filters.entityId;
      case "organisation":
        return filters.organisation;
      case "location":
        return filters.location;
      case "designation":
        return filters.designation;
      case "department":
        return filters.departmentId;
      case "reportingManager":
        return filters.reportingManagerId;
      case "gender":
        return filters.gender;
      case "status":
        return filters.status;
      case "employmentType":
        return filters.employmentType;
      case "branch":
        return filters.branchId;
      default:
        return "";
    }
  }

  function onHeaderFilterChange(key: EmployeeTableColumnKey, value: string) {
    setFilters((f) => {
      switch (key) {
        case "entity":
          return { ...f, entityId: value };
        case "organisation":
          return { ...f, organisation: value };
        case "location":
          return { ...f, location: value };
        case "designation":
          return { ...f, designation: value };
        case "department":
          return { ...f, departmentId: value };
        case "reportingManager":
          return { ...f, reportingManagerId: value };
        case "gender":
          return { ...f, gender: value };
        case "status":
          return { ...f, status: value };
        case "employmentType":
          return { ...f, employmentType: value };
        case "branch":
          return { ...f, branchId: value };
        default:
          return f;
      }
    });
  }

  function headerFilterChoices(key: EmployeeTableColumnKey): { value: string; label: string }[] {
    switch (key) {
      case "entity":
        return entityOptions.map((e) => ({ value: e.id, label: e.label }));
      case "organisation":
        return headerFilterOptions.organisations;
      case "location":
        return headerFilterOptions.locations;
      case "designation":
        return headerFilterOptions.designations;
      case "department":
        return headerFilterOptions.departments;
      case "reportingManager":
        return headerFilterOptions.managers;
      case "gender":
        return headerFilterOptions.genders;
      case "status":
        return headerFilterOptions.statuses;
      case "employmentType":
        return headerFilterOptions.employmentTypes;
      case "branch":
        return headerFilterOptions.branches;
      default:
        return [];
    }
  }

  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  const pageRows = useMemo(() => {
    if (!directoryReady) return records;
    const start = (page - 1) * EMPLOYEE_LIST_PAGE_SIZE;
    return filtered.slice(start, start + EMPLOYEE_LIST_PAGE_SIZE);
  }, [directoryReady, filtered, page, records]);

  const listTotal = directoryReady
    ? filtered.length
    : (page - 1) * EMPLOYEE_LIST_PAGE_SIZE +
      records.length +
      (records.length >= EMPLOYEE_LIST_PAGE_SIZE ? 1 : 0);

  async function onListPageChange(next: number) {
    if (directoryReady) {
      setPage(next);
      return;
    }
    setPage(next);
    try {
      const res = await listEmployeesPage(next, EMPLOYEE_LIST_PAGE_SIZE);
      setRecords(res.records);
    } catch {
      toast("Failed to load employees", "error");
    }
  }
  const orderedVisibleColumns = useMemo(
    () => ALL_EMPLOYEE_TABLE_COLUMN_KEYS.filter((key) => visibleColumns.has(key)),
    [visibleColumns],
  );

  const authBlocked = !isAuthenticated() && !loading && records.length === 0;

  const selectedRecords = useMemo(
    () => records.filter((r) => selected.has(r.id)),
    [records, selected],
  );

  function toggleAll(checked: boolean) {
    const ids = directoryReady ? filtered : pageRows;
    if (checked) setSelected(new Set(ids.map((r) => r.id)));
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
    toast(`${title} - ${selectedRecords.length} employee(s)`, "success");
    setSelected(new Set());
    void load();
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Employee Management"
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
            <FilterSelect
              className={cn("w-[200px]", filters.entityId && "font-medium")}
              value={filters.entityId}
              onChange={(entityId) => setFilters((f) => ({ ...f, entityId }))}
              placeholder="All entities"
              options={[
                { value: "", label: "All entities" },
                ...entityOptions.map((c) => ({ value: c.id, label: c.label })),
              ]}
            />
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant={columnsOpen ? "secondary" : "outline"}
                className="cursor-pointer h-8"
                onClick={() => setColumnsOpen((open) => !open)}
              >
                <Columns3 className="size-3.5" />
                Edit columns
              </Button>
              {columnsOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close column picker"
                    onClick={() => setColumnsOpen(false)}
                  />
                  <div className="absolute top-9 left-0 z-20 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md">
                    <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Excel fields — add or remove
                    </p>
                    {EXCEL_EMPLOYEE_TABLE_COLUMNS.map((key) => {
                      const required = REQUIRED_EMPLOYEE_TABLE_COLUMNS.includes(key);
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60",
                            required ? "cursor-default opacity-80" : "cursor-pointer",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(key)}
                            disabled={required}
                            onChange={() => toggleColumn(key)}
                          />
                          {EMPLOYEE_TABLE_COLUMN_LABELS[key]}
                        </label>
                      );
                    })}
                    {EXTRA_EMPLOYEE_TABLE_COLUMNS.length ? (
                      <>
                        <p className="mt-2 px-1.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-t border-border/60">
                          More columns
                        </p>
                        {EXTRA_EMPLOYEE_TABLE_COLUMNS.map((key) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns.has(key)}
                              onChange={() => toggleColumn(key)}
                            />
                            {EMPLOYEE_TABLE_COLUMN_LABELS[key]}
                          </label>
                        ))}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="mt-2 w-full cursor-pointer rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-primary hover:bg-muted/40"
                      onClick={() => resetColumns()}
                    >
                      Reset to default
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            {filtersActive ? (
              <button
                type="button"
                className="cursor-pointer text-xs font-medium text-primary transition-colors duration-200 hover:underline"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            ) : null}
            <div
              role="group"
              aria-label="Workforce type"
              className="ml-auto inline-flex h-8 items-center rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {(
                [
                  { value: "", label: "All" },
                  { value: "office", label: "Office" },
                  { value: "client", label: "Client" },
                ] as const
              ).map((opt) => {
                const active = filters.workforceScope === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "h-7 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors duration-200",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() =>
                      setFilters((f) => ({ ...f, workforceScope: opt.value }))
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

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
                        title: "Mark as resigned",
                        message: "Mark selected employees as resigned?",
                        action: () => runBulk("resigned", "Resigned"),
                      })
                    }
                  >
                    <UserMinus className="size-3" />
                    Resigned
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

              {!filtered.length ? (
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
                  <div className="erp-scroll max-h-[calc(100vh-18rem)] overflow-auto [scrollbar-gutter:stable]">
                    <table className="w-max min-w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm">
                        <tr>
                          <th className="w-10 min-w-10 px-2 py-2 align-middle">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                              onChange={(e) => toggleAll(e.target.checked)}
                            />
                          </th>
                          {orderedVisibleColumns.map((key) => (
                            <th
                              key={key}
                              className={cn(
                                "px-2 py-2 align-top",
                                COLUMN_CELL_CLASS[key] ?? "min-w-[6.5rem]",
                              )}
                            >
                              <div className="space-y-1">
                                <span
                                  className={cn(
                                    "block truncate text-[10px] font-semibold tracking-wide text-muted-foreground",
                                    EXACT_CASE_HEADER_COLUMNS.has(key)
                                      ? "normal-case"
                                      : "uppercase",
                                  )}
                                  title={EMPLOYEE_TABLE_COLUMN_LABELS[key]}
                                >
                                  {EMPLOYEE_TABLE_COLUMN_LABELS[key]}
                                </span>
                                {HEADER_FILTER_COLUMNS.has(key) ? (
                                  <select
                                    className={cn(
                                      "h-7 w-full max-w-full cursor-pointer truncate rounded-md border border-input/80 bg-background px-1.5 text-[10px] outline-none transition-colors duration-200",
                                      "hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
                                      headerFilterValue(key) &&
                                        "border-primary/40 bg-primary/5 font-medium text-foreground",
                                    )}
                                    value={headerFilterValue(key)}
                                    onChange={(e) => onHeaderFilterChange(key, e.target.value)}
                                    aria-label={`Filter ${EMPLOYEE_TABLE_COLUMN_LABELS[key]}`}
                                  >
                                    <option value="">All</option>
                                    {headerFilterChoices(key).map((opt) => (
                                      <option key={`${key}-${opt.value}`} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            </th>
                          ))}
                          <th className="w-12 min-w-12 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                          >
                            <td className="w-10 min-w-10 px-2 py-2 align-middle">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={selected.has(row.id)}
                                onChange={() => toggleOne(row.id)}
                              />
                            </td>
                            {orderedVisibleColumns.map((key) => (
                              <td
                                key={key}
                                className={cn(
                                  "px-2 py-2 align-middle text-xs",
                                  COLUMN_CELL_CLASS[key] ?? "min-w-[6.5rem]",
                                )}
                              >
                                {key === "name" ? (
                                  <Link
                                    href={`/hr/workforce/${row.id}`}
                                    className="flex min-w-0 cursor-pointer items-center gap-2 hover:text-primary"
                                  >
                                    <EmsAvatar
                                      name={row.displayName}
                                      photoUrl={row.profilePhotoDataUrl}
                                      size="sm"
                                    />
                                    <span className="truncate font-medium">{row.displayName}</span>
                                  </Link>
                                ) : (
                                  <span className="block truncate">
                                    {renderEmployeeCell(key, row)}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td className="w-12 min-w-12 px-2 py-2 align-middle">
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
                                    setConfirm({
                                      title: "Mark as resigned",
                                      message: `Mark ${row.displayName || row.employeeCode} as resigned?`,
                                      action: async () => {
                                        await setEmployeeLifecycleStatus(row, "resigned", "Resigned");
                                        await load();
                                      },
                                    });
                                  }}
                                >
                                  <UserMinus className="size-3.5 text-muted-foreground" />
                                  Resigned
                                </RowActionsItem>
                                <RowActionsItem
                                  destructive
                                  onClick={() => {
                                    setConfirm({
                                      title: "Delete Employee",
                                      message:
                                        "Soft delete this employee? The record is retained and can be restored later.",
                                      action: async () => {
                                        await setEmployeeLifecycleStatus(row, "archived", "Deleted");
                                        await load();
                                      },
                                    });
                                    setMenuId(null);
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
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
                      pageSize={EMPLOYEE_LIST_PAGE_SIZE}
                      total={listTotal}
                      onPageChange={(next) => void onListPageChange(next)}
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
        destructive={confirm?.title.toLowerCase().includes("delete")}
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
