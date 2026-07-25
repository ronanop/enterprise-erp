"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  CheckSquare,
  Copy,
  Download,
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
  SetupTimeInput,
  toTimeInputValue,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nextCode, type HrSetupTab } from "@/config/hr-setup";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  archiveLocal,
  cell,
  createLocalSetup,
  duplicateLocal,
  exportRowsCsv,
  listLocalSetup,
  listReportingManagers,
  listSetupApi,
  loadSetupOrgLookups,
  softDeleteLocal,
  updateLocalSetup,
  type SetupRow,
} from "@/services/hr-setup-service";
import { cn } from "@/lib/utils";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "textarea" | "checkbox";
  required?: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
  /** Load options from organization masters */
  optionsSource?: "companies" | "branches" | "departments" | "employees" | "shifts";
  /** Prefill first available option on create */
  autoDefault?: boolean;
  placeholder?: string;
  hint?: string;
};

type ColumnDef = {
  key: string;
  label: string;
  render?: (row: SetupRow) => ReactNode;
};

type Mode = "create" | "edit" | "view" | "history" | null;

const PAGE_SIZE = 10;

function SkeletonRows() {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

function AuditBlock({ row }: { row: SetupRow }) {
  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-[11px] text-muted-foreground sm:grid-cols-2">
      <div>
        <span className="font-medium text-foreground">Created by</span>
        <p>{cell(row, "created_by")}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Created at</span>
        <p>{cell(row, "created_at")}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Updated by</span>
        <p>{cell(row, "updated_by")}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Updated at</span>
        <p>{cell(row, "updated_at")}</p>
      </div>
    </div>
  );
}

export function SetupEntityPanel({
  tab,
  columns,
  fields,
  nameKeys,
  codeKey = "code",
  mapApiRow,
  buildCreateBody,
  buildUpdateBody,
  statusActions,
  statsExtra,
}: {
  tab: HrSetupTab;
  columns: ColumnDef[];
  fields: FieldDef[];
  nameKeys: string[];
  codeKey?: string;
  mapApiRow?: (row: SetupRow) => SetupRow;
  buildCreateBody?: (form: Record<string, string>) => Record<string, unknown>;
  buildUpdateBody?: (form: Record<string, string>) => Record<string, unknown>;
  statusActions?: {
    activate?: string;
    deactivate?: string;
    archive?: string;
  };
  statsExtra?: (rows: SetupRow[]) => { label: string; value: number | string }[];
}) {
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>(null);
  const [active, setActive] = useState<SetupRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: "delete" | "archive" | "activate" | "deactivate";
    ids: string[];
  } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [orgLookups, setOrgLookups] = useState<{
    companies: { value: string; label: string }[];
    branches: { value: string; label: string; companyId?: string }[];
    departments: { value: string; label: string }[];
    employees: { value: string; label: string }[];
    shifts: { value: string; label: string }[];
  }>({ companies: [], branches: [], departments: [], employees: [], shifts: [] });

  const needsOrgLookups = fields.some((f) => f.optionsSource);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: SetupRow[] = [];
      if (tab.source === "local") {
        data = await listLocalSetup(tab.id);
      } else if (tab.source === "derived") {
        data = await listReportingManagers();
      } else if (tab.apiPath) {
        data = await listSetupApi(tab.apiPath);
        if (mapApiRow) data = data.map(mapApiRow);
      }
      setRows(data);
      setSelected(new Set());
      if (needsOrgLookups) {
        const lookups = await loadSetupOrgLookups();
        setOrgLookups(lookups);
      }
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load records", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, mapApiRow, needsOrgLookups]);

  useEffect(() => {
    void load();
    setPage(1);
    setQuery("");
    setStatusFilter("all");
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && String(row.status ?? "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const base = [
      { label: "Total", value: rows.length },
      {
        label: "Active",
        value: rows.filter((r) => String(r.status).toLowerCase() === "active").length,
      },
      {
        label: "Inactive / Archived",
        value: rows.filter((r) =>
          ["inactive", "archived", "draft"].includes(String(r.status).toLowerCase()),
        ).length,
      },
      { label: "Selected", value: selected.size },
    ];
    return statsExtra ? [...base, ...statsExtra(rows)] : base;
  }, [rows, selected, statsExtra]);

  function resolveFieldOptions(f: FieldDef): { value: string; label: string }[] {
    if (f.options?.length) return f.options;
    if (f.optionsSource === "companies") return orgLookups.companies;
    if (f.optionsSource === "branches") {
      return orgLookups.branches.map(({ value, label }) => ({ value, label }));
    }
    if (f.optionsSource === "departments") {
      return orgLookups.departments.filter((d) => d.value !== active?.id);
    }
    if (f.optionsSource === "employees") return orgLookups.employees;
    if (f.optionsSource === "shifts") return orgLookups.shifts;
    return [];
  }

  function openCreate() {
    const codes = rows.map((r) => String(r[codeKey] ?? r.code ?? ""));
    const prefix = tab.codePrefix ?? "CFG";
    const initial: Record<string, string> = {};
    for (const f of fields) {
      if (f.key === codeKey || f.key === "code" || f.key.endsWith("_code") || f.key === "document_number") {
        initial[f.key] = nextCode(prefix, codes);
      } else if (f.type === "checkbox") {
        initial[f.key] = "false";
      } else if (f.key === "status") {
        initial[f.key] = "active";
      } else if (f.type === "time" && f.key === "start_time") {
        initial[f.key] = "09:00";
      } else if (f.type === "time" && f.key === "end_time") {
        initial[f.key] = "18:00";
      } else if (f.type === "time" && f.key === "break_start") {
        initial[f.key] = "13:00";
      } else if (f.type === "time" && f.key === "break_end") {
        initial[f.key] = "14:00";
      } else if (f.autoDefault || f.optionsSource) {
        const opts =
          f.optionsSource === "companies"
            ? orgLookups.companies
            : f.optionsSource === "branches"
              ? orgLookups.branches
              : f.optionsSource === "departments"
                ? orgLookups.departments
                : f.optionsSource === "employees"
                  ? orgLookups.employees
                  : f.optionsSource === "shifts"
                    ? orgLookups.shifts
                    : (f.options ?? []);
        initial[f.key] = f.autoDefault && opts[0] ? opts[0].value : "";
      } else {
        initial[f.key] = "";
      }
    }

    // If branch selected and company empty, derive company from branch
    if (initial.branch_id && !initial.company_id) {
      const br = orgLookups.branches.find((b) => b.value === initial.branch_id);
      if (br?.companyId) initial.company_id = br.companyId;
    }
    if (!initial.company_id && orgLookups.companies[0]) {
      initial.company_id = orgLookups.companies[0].value;
    }
    if (!initial.branch_id && orgLookups.branches[0]) {
      initial.branch_id = orgLookups.branches[0].value;
      if (!initial.company_id && orgLookups.branches[0].companyId) {
        initial.company_id = orgLookups.branches[0].companyId;
      }
    }

    setForm(initial);
    setActive(null);
    setMode("create");
  }

  function openEdit(row: SetupRow, viewOnly = false) {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const v = row[f.key];
      const isTime =
        f.type === "time" || (!f.type && /(_time|break_start|break_end)$/i.test(f.key));
      if (isTime) {
        initial[f.key] = toTimeInputValue(v == null ? "" : String(v));
      } else {
        initial[f.key] = v == null ? "" : String(v);
      }
    }
    setForm(initial);
    setActive(row);
    setMode(viewOnly ? "view" : "edit");
  }

  function openHistory(row: SetupRow) {
    setActive(row);
    setMode("history");
  }

  async function save() {
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? "").trim()) {
        toast(`${f.label} is required`, "error");
        return;
      }
    }
    setSaving(true);
    try {
      if (tab.source === "local") {
        if (mode === "create") {
          await createLocalSetup(tab.id, tab.codePrefix ?? "CFG", form);
        } else if (active) {
          await updateLocalSetup(tab.id, active.id, form);
        }
      } else if (tab.apiPath) {
        if (mode === "create") {
          const body = buildCreateBody ? buildCreateBody(form) : form;
          await resourceService.create(tab.apiPath, body);
        } else if (active) {
          const body = buildUpdateBody ? buildUpdateBody(form) : form;
          await resourceService.update(tab.apiPath, active.id, body);
        }
      }
      toast(mode === "create" ? "Record created" : "Record updated");
      setMode(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setSaving(true);
    try {
      const { type, ids } = confirm;
      if (tab.source === "local") {
        if (type === "delete") await softDeleteLocal(tab.id, ids);
        if (type === "archive") await archiveLocal(tab.id, ids, true);
        if (type === "activate") await archiveLocal(tab.id, ids, false);
        if (type === "deactivate") await archiveLocal(tab.id, ids, true);
      } else if (tab.apiPath) {
        for (const id of ids) {
          if (type === "delete") {
            await resourceService.delete(tab.apiPath, id);
          } else if (type === "archive") {
            await resourceService.update(tab.apiPath, id, {
              status: statusActions?.archive ?? "archived",
            });
          } else if (type === "deactivate") {
            await resourceService.update(tab.apiPath, id, {
              status: statusActions?.deactivate ?? "inactive",
            });
          } else if (type === "activate") {
            await resourceService.update(tab.apiPath, id, {
              status: statusActions?.activate ?? "active",
            });
          }
        }
      }
      toast("Action completed");
      setConfirm(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateRow(row: SetupRow) {
    try {
      if (tab.source === "local") {
        await duplicateLocal(tab.id, row.id, tab.codePrefix ?? "CFG");
      } else if (tab.apiPath) {
        const { id: _id, version: _version, __source: _src, ...rest } = row;
        const body: Record<string, unknown> = { ...rest };
        if (codeKey in body) {
          body[codeKey] = nextCode(
            tab.codePrefix ?? "CFG",
            rows.map((r) => String(r[codeKey] ?? "")),
          );
        }
        await resourceService.create(tab.apiPath, body);
      }
      toast("Duplicated");
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Duplicate failed", "error");
    }
  }

  const readOnly = mode === "view" || tab.source === "derived";
  const canCreate = tab.source !== "derived";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{tab.title}</h2>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {tab.source === "api" ? "Live API" : tab.source === "local" ? "Config store" : "Derived"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{tab.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() =>
              exportRowsCsv(
                `${tab.id}.csv`,
                filtered,
                columns.map((c) => c.key),
              )
            }
          >
            <Download className="size-3.5" />
            Export
          </Button>
          {canCreate ? (
            <Button type="button" size="sm" className="cursor-pointer" onClick={openCreate}>
              <Plus className="size-3.5" />
              Add {tab.title.replace(/s$/, "")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {s.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search…"
            className="pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs">
          <CheckSquare className="size-3.5" />
          <span className="font-medium">{selected.size} selected</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setConfirm({ type: "activate", ids: [...selected] })}
          >
            Activate
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setConfirm({ type: "deactivate", ids: [...selected] })}
          >
            Deactivate
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setConfirm({ type: "archive", ids: [...selected] })}
          >
            Archive
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            className="cursor-pointer"
            onClick={() => setConfirm({ type: "delete", ids: [...selected] })}
          >
            Delete
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="cursor-pointer"
            onClick={() =>
              exportRowsCsv(
                `${tab.id}-selected.csv`,
                rows.filter((r) => selected.has(r.id)),
                columns.map((c) => c.key),
              )
            }
          >
            Export
          </Button>
        </div>
      ) : null}

      {loading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/50 px-6 py-12 text-center">
          <p className="text-sm font-medium">No records found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust filters or create the first {tab.title.toLowerCase()} record.
          </p>
          {canCreate ? (
            <Button type="button" size="sm" className="mt-4 cursor-pointer" onClick={openCreate}>
              <Plus className="size-3.5" />
              Add {tab.title.replace(/s$/, "")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/40">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                      onChange={(e) => {
                        const next = new Set(selected);
                        for (const r of pageRows) {
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                        }
                        setSelected(next);
                      }}
                    />
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={selected.has(row.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 align-middle">
                        {c.render
                          ? c.render(row)
                          : c.key === "status"
                            ? <HrStatusBadge status={cell(row, "status")} />
                            : cell(row, c.key, ...nameKeys)}
                      </td>
                    ))}
                    <td className="relative px-3 py-2">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                      {menuId === row.id ? (
                        <div className="absolute top-8 right-2 z-20 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                          {(
                            [
                              { label: "View", icon: Eye, fn: () => openEdit(row, true) },
                              { label: "Edit", icon: Pencil, fn: () => openEdit(row) },
                              { label: "Duplicate", icon: Copy, fn: () => void duplicateRow(row) },
                              { label: "History", icon: History, fn: () => openHistory(row) },
                              {
                                label: "Archive",
                                icon: Archive,
                                fn: () => setConfirm({ type: "archive", ids: [row.id] }),
                              },
                              {
                                label: "Delete",
                                icon: Trash2,
                                fn: () => setConfirm({ type: "delete", ids: [row.id] }),
                              },
                            ] as const
                          ).map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                              onClick={() => {
                                setMenuId(null);
                                item.fn();
                              }}
                            >
                              <item.icon className="size-3.5 text-muted-foreground" />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="cursor-pointer"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="cursor-pointer"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <SetupDrawer
        open={mode === "create" || mode === "edit" || mode === "view"}
        title={
          mode === "create"
            ? `Add ${tab.title.replace(/s$/, "")}`
            : mode === "view"
              ? `View ${tab.title.replace(/s$/, "")}`
              : `Edit ${tab.title.replace(/s$/, "")}`
        }
        description={tab.description}
        wide
        onClose={() => setMode(null)}
        footer={
          mode === "view" ? (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="button" className="cursor-pointer" disabled={saving || readOnly} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
              <SetupField label={f.label} required={f.required} hint={f.hint}>
                {f.type === "textarea" ? (
                  <SetupTextarea
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                ) : f.type === "select" || f.optionsSource ? (
                  <SetupSelect
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => {
                        const next = { ...prev, [f.key]: value };
                        if (f.key === "branch_id") {
                          const br = orgLookups.branches.find((b) => b.value === value);
                          if (br?.companyId) next.company_id = br.companyId;
                        }
                        return next;
                      });
                    }}
                  >
                    <option value="">{f.required ? "Select…" : "None"}</option>
                    {resolveFieldOptions(f).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SetupSelect>
                ) : f.type === "time" ||
                  (!f.type && /(_time|break_start|break_end)$/i.test(f.key)) ? (
                  <SetupTimeInput
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ) : f.type === "checkbox" ? (
                  <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[f.key] === "true"}
                      disabled={readOnly || f.readOnly}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [f.key]: e.target.checked ? "true" : "false" }))
                      }
                    />
                    Enabled
                  </label>
                ) : (
                  <SetupInput
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                )}
              </SetupField>
            </div>
          ))}
        </div>
        {active ? <AuditBlock row={active} /> : null}
      </SetupDrawer>

      <SetupDrawer
        open={mode === "history"}
        title="Audit history"
        description="Created / updated metadata for this record"
        onClose={() => setMode(null)}
        footer={
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setMode(null)}>
            Close
          </Button>
        }
      >
        {active ? (
          <>
            <p className="text-sm font-medium">{cell(active, ...nameKeys)}</p>
            <AuditBlock row={active} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Full change-log timeline requires audit API enrichment. Showing available audit columns.
            </p>
          </>
        ) : null}
      </SetupDrawer>

      <SetupConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.type === "delete"
            ? "Delete records?"
            : confirm?.type === "archive"
              ? "Archive records?"
              : confirm?.type === "deactivate"
                ? "Deactivate records?"
                : "Activate records?"
        }
        message={
          confirm?.type === "delete"
            ? "This performs a soft delete / inactivate where supported. You can restore via Activate when available."
            : "Confirm this bulk status change for the selected records."
        }
        confirmLabel={confirm?.type === "delete" ? "Delete" : "Confirm"}
        destructive={confirm?.type === "delete"}
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}
