"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Columns3,
  Download,
  Eye,
  Pencil,
  Plus,
  Upload,
  UserCheck,
  UserMinus,
} from "lucide-react";

import {
  EmsAvatar,
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
import { SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { isAuthenticated } from "@/lib/auth";
import {
  EXACT_CASE_HEADER_COLUMNS,
  renderEmployeeCell,
} from "@/lib/employee-table-columns";
import {
  EMPLOYEE_TABLE_COLUMN_LABELS,
  REQUIRED_EMPLOYEE_TABLE_COLUMNS,
  useEmployeeTablePrefs,
  type EmployeeTableColumnKey,
} from "@/hooks/use-employee-table-prefs";
import {
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
  GENDER_OPTIONS,
  LIFECYCLE_STATUS_OPTIONS,
} from "@/config/hr-master-options";
import {
  listEmploymentTypeOptions,
  type SetupMasterOption,
} from "@/services/hr-setup-service";

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
  const [employmentTypeOptions, setEmploymentTypeOptions] = useState<SetupMasterOption[]>(
    EMPLOYMENT_TYPE_FILTER_OPTIONS,
  );
  const [columnsOpen, setColumnsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ records: rows, options: opts, errors }, employmentTypes] = await Promise.all([
        loadEmployeeDirectory(),
        listEmploymentTypeOptions(),
      ]);
      setRecords(rows);
      setOptions(opts);
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
  const orderedVisibleColumns = useMemo(
    () =>
      (Object.keys(EMPLOYEE_TABLE_COLUMN_LABELS) as EmployeeTableColumnKey[]).filter((key) =>
        visibleColumns.has(key),
      ),
    [visibleColumns],
  );

  const authBlocked = !isAuthenticated() && !loading && records.length === 0;

  const selectedRecords = useMemo(
    () => records.filter((r) => selected.has(r.id)),
    [records, selected],
  );

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(filtered.map((r) => r.id)));
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

  function renderColumnFilter(key: EmployeeTableColumnKey): ReactNode {
    switch (key) {
      case "entity":
        return (
          <HeaderFilterSelect
            value={filters.entityId}
            onChange={(v) => setFilters((f) => ({ ...f, entityId: v }))}
            options={[
              { value: "digitech", label: "Digitech" },
              { value: "technology", label: "Technologies" },
            ]}
          />
        );
      case "location":
        return (
          <HeaderFilterSelect
            value={filters.location}
            onChange={(v) => setFilters((f) => ({ ...f, location: v }))}
            options={[
              ...new Map(
                (options?.locations ?? []).map((loc) => [
                  loc.label.toLowerCase(),
                  { value: loc.label, label: loc.label },
                ]),
              ).values(),
            ]}
          />
        );
      case "designation":
        return (
          <HeaderFilterSelect
            value={filters.designation}
            onChange={(v) => setFilters((f) => ({ ...f, designation: v }))}
            options={[...new Set(records.map((r) => r.designationName))]
              .filter(Boolean)
              .map((d) => ({ value: d, label: d }))}
          />
        );
      case "department":
        return (
          <HeaderFilterSelect
            value={filters.departmentId}
            onChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))}
            options={options?.departments.map((d) => ({ value: d.id, label: d.label })) ?? []}
          />
        );
      case "reportingManager":
        return (
          <HeaderFilterSelect
            value={filters.reportingManagerId}
            onChange={(v) => setFilters((f) => ({ ...f, reportingManagerId: v }))}
            options={options?.managers.map((m) => ({ value: m.id, label: m.label })) ?? []}
          />
        );
      case "employmentType":
        return (
          <HeaderFilterSelect
            value={filters.employmentType}
            onChange={(v) => setFilters((f) => ({ ...f, employmentType: v }))}
            options={employmentTypeOptions.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
        );
      case "gender":
        return (
          <HeaderFilterSelect
            value={filters.gender}
            onChange={(v) => setFilters((f) => ({ ...f, gender: v }))}
            options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
          />
        );
      case "joiningDate":
        return (
          <Input
            type="date"
            className="h-7 w-full min-w-[110px] text-[10px]"
            value={filters.joiningFrom}
            onChange={(e) => setFilters((f) => ({ ...f, joiningFrom: e.target.value }))}
          />
        );
      case "status":
        return (
          <HeaderFilterSelect
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={LIFECYCLE_STATUS_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
          />
        );
      default:
        return null;
    }
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
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant={columnsOpen ? "secondary" : "outline"}
                className="cursor-pointer h-8"
                onClick={() => setColumnsOpen((open) => !open)}
              >
                <Columns3 className="size-3.5" />
                Columns
              </Button>
              {columnsOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close column picker"
                    onClick={() => setColumnsOpen(false)}
                  />
                  <div className="absolute top-9 left-0 z-20 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md">
                    <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Show columns
                    </p>
                    {(Object.keys(EMPLOYEE_TABLE_COLUMN_LABELS) as EmployeeTableColumnKey[]).map(
                      (key) => {
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
                      },
                    )}
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
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </button>
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
                  <div className="erp-scroll max-h-[calc(100vh-18rem)] overflow-auto">
                    <table className="w-full min-w-[960px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 backdrop-blur-sm">
                        <tr>
                          <th className="w-10 px-2 py-2 align-bottom">
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                              onChange={(e) => toggleAll(e.target.checked)}
                            />
                          </th>
                          {orderedVisibleColumns.map((key) => (
                            <HeaderFilterTh
                              key={key}
                              label={EMPLOYEE_TABLE_COLUMN_LABELS[key]}
                              exactCase={EXACT_CASE_HEADER_COLUMNS.has(key)}
                            >
                              {renderColumnFilter(key)}
                            </HeaderFilterTh>
                          ))}
                          <th className="w-12 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row) => (
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
                            {orderedVisibleColumns.map((key) => (
                              <td key={key} className="px-2 py-2 text-xs">
                                {key === "name" ? (
                                  <Link
                                    href={`/hr/workforce/${row.id}`}
                                    className="flex cursor-pointer items-center gap-2 hover:text-primary"
                                  >
                                    <EmsAvatar
                                      name={row.displayName}
                                      photoUrl={row.profilePhotoDataUrl}
                                      size="sm"
                                    />
                                    <span className="font-medium">{row.displayName}</span>
                                  </Link>
                                ) : (
                                  renderEmployeeCell(key, row)
                                )}
                              </td>
                            ))}
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
                  <div className="flex items-center border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
                    <span>
                      {filtered.length === 0
                        ? "No employees"
                        : `Showing ${filtered.length} employee${filtered.length === 1 ? "" : "s"}`}
                      {query || Object.values(filters).some(Boolean)
                        ? ` (filtered from ${records.length})`
                        : ""}
                    </span>
                  </div>
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
  exactCase = false,
}: {
  label: string;
  children?: ReactNode;
  /** Keep label casing (Excel-style) instead of forcing uppercase */
  exactCase?: boolean;
}) {
  return (
    <th className="px-1.5 py-2 align-bottom">
      <div className="space-y-1">
        <span
          className={cn(
            "block whitespace-nowrap text-[10px] font-semibold tracking-wide text-muted-foreground",
            exactCase ? "normal-case" : "uppercase",
          )}
        >
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
