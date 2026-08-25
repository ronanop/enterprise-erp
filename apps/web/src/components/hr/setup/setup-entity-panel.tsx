"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  CheckSquare,
  Download,
  Eye,
  History,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { RoomEquipmentEditor } from "@/components/hr/setup/room-equipment-editor";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { nextCode, type HrSetupTab } from "@/config/hr-setup";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  archiveLocal,
  cell,
  coerceLocalForm,
  createLocalSetup,
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
  type?:
    | "text"
    | "number"
    | "date"
    | "time"
    | "select"
    | "searchable"
    | "textarea"
    | "checkbox"
    | "equipment_list";
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

/** Plural tab titles → singular labels for Add / Edit actions. */
function singularTabTitle(title: string): string {
  if (title.endsWith("ies")) return `${title.slice(0, -3)}y`;
  if (/(?:ches|shes|sses|xes|zes)$/i.test(title)) return title.slice(0, -2);
  if (title.endsWith("s") && !title.endsWith("ss")) return title.slice(0, -1);
  return title;
}

function toFormValue(value: unknown, type?: FieldDef["type"]): string {
  if (value == null) return type === "checkbox" ? "false" : "";
  if (type === "checkbox") {
    if (typeof value === "boolean") return value ? "true" : "false";
    const s = String(value).trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" ? "true" : "false";
  }
  return String(value);
}

function isFormChecked(value: string | undefined): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function SkeletonRows() {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

/**
 * Percentage-only widths that always sum to 100% (checkbox 5% + actions 8% + data = 87%).
 * Mixing rem + % was causing horizontal overflow.
 */
function setupColumnWidths(columns: { key: string }[]): string[] {
  const budget = 87;
  if (columns.length === 0) return [];
  const weights = columns.map((c, i) => {
    if (
      c.key === "code" ||
      c.key === "employee_code" ||
      c.key === "status" ||
      c.key === "sort_order" ||
      c.key === "capacity" ||
      c.key === "leave_days" ||
      c.key === "year" ||
      c.key === "paid"
    ) {
      return 0.75;
    }
    if (i === 0) return 1.55;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => `${((w / total) * budget).toFixed(2)}%`);
}

function formatAuditWhen(value: unknown): string {
  if (value == null || String(value).trim() === "") return "—";
  const raw = String(value).trim();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAuditWho(value: unknown, usersById: Record<string, string>): string {
  if (value == null || String(value).trim() === "") return "—";
  const id = String(value).trim();
  if (usersById[id]) return usersById[id];
  if (id === "current.user") {
    try {
      const raw = localStorage.getItem("erp_user_profile");
      if (raw) {
        const p = JSON.parse(raw) as { full_name?: string; email?: string };
        return p.full_name || p.email || "Current user";
      }
    } catch {
      /* ignore */
    }
    return "Current user";
  }
  // UUID → short readable fallback
  if (/^[0-9a-f-]{36}$/i.test(id)) return `User ${id.slice(0, 8)}…`;
  return id;
}

function resolveEmployeeLabel(
  value: unknown,
  employees: { value: string; label: string }[],
): string {
  if (value == null || value === "" || value === "—") return "—";
  const id = String(value).trim();
  const found = employees.find((e) => e.value === id);
  if (found) {
    // Label is often "Name · CODE" — show name only in the grid
    return found.label.split(" · ")[0]?.trim() || found.label;
  }
  if (/^[0-9a-f-]{36}$/i.test(id)) return "—";
  return id;
}

function AuditBlock({
  row,
  usersById,
}: {
  row: SetupRow;
  usersById: Record<string, string>;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-[11px] text-muted-foreground sm:grid-cols-2">
      <div>
        <span className="font-medium text-foreground">Created by</span>
        <p>{formatAuditWho(row.created_by, usersById)}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Created at</span>
        <p>{formatAuditWhen(row.created_at)}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Updated by</span>
        <p>{formatAuditWho(row.updated_by, usersById)}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Updated at</span>
        <p>{formatAuditWhen(row.updated_at)}</p>
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
  const [usersById, setUsersById] = useState<Record<string, string>>({});

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
      // Best-effort user directory for audit "created by / updated by" labels
      void resourceService
        .list<Record<string, unknown>>("/users")
        .then((res) => {
          const map: Record<string, string> = {};
          const list = Array.isArray(res.data) ? res.data : [];
          for (const u of list) {
            const id = String(u.id ?? "");
            if (!id) continue;
            map[id] = String(u.display_name || u.email || id);
          }
          setUsersById(map);
        })
        .catch(() => {
          /* permission may block; UUIDs still show as short ids */
        });
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
  const columnWidths = useMemo(() => setupColumnWidths(columns), [columns]);

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
    const codes = rows.flatMap((r) =>
      [r[codeKey], r.code, r.branch_code, r.department_code, r.designation_code]
        .map((v) => String(v ?? ""))
        .filter(Boolean),
    );
    const prefix = tab.codePrefix ?? "CFG";
    const initial: Record<string, string> = {};
    const usedCodes = [...codes];
    for (const f of fields) {
      // Only mint the entity identity code — never state_code / country_code / etc.
      const isIdentityCode =
        f.key === codeKey || f.key === "code" || f.key === "document_number";
      if (isIdentityCode) {
        const minted = nextCode(prefix, usedCodes);
        initial[f.key] = minted;
        usedCodes.push(minted);
      } else if (f.type === "checkbox") {
        initial[f.key] = "false";
      } else if (f.key === "status") {
        initial[f.key] = "active";
      } else if (f.key === "country_code" && f.type === "searchable") {
        initial[f.key] = "IN";
      } else if (f.key === "company_id") {
        // Prefer the signed-in org company so created branches appear in the list
        const sessionCompanyId = getStoredOrgContext()?.companyId
          ? String(getStoredOrgContext()?.companyId)
          : "";
        const companies = orgLookups.companies;
        if (sessionCompanyId && companies.some((c) => c.value === sessionCompanyId)) {
          initial[f.key] = sessionCompanyId;
        } else if (f.autoDefault && companies[0]) {
          initial[f.key] = companies[0].value;
        } else {
          initial[f.key] = "";
        }
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
    const initial: Record<string, string> = {
      version: String(row.version ?? 1),
    };
    for (const f of fields) {
      const v = row[f.key];
      const isTime =
        f.type === "time" || (!f.type && /(_time|break_start|break_end)$/i.test(f.key));
      if (isTime) {
        initial[f.key] = toTimeInputValue(v == null ? "" : String(v));
      } else {
        initial[f.key] = toFormValue(v, f.type);
      }
    }
    setForm(initial);
    setActive(row);
    setMenuId(null);
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
    const minRaw = form.min_ctc;
    const maxRaw = form.max_ctc;
    if (minRaw != null && minRaw !== "" && maxRaw != null && maxRaw !== "") {
      const min = Number(minRaw);
      const max = Number(maxRaw);
      if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
        toast("Maximum salary must be ≥ minimum salary", "error");
        return;
      }
    }
    setSaving(true);
    try {
      if (tab.source === "local") {
        const payload = coerceLocalForm(fields, form);
        if (mode === "create") {
          await createLocalSetup(tab.id, tab.codePrefix ?? "CFG", payload);
        } else if (active) {
          await updateLocalSetup(tab.id, active.id, payload);
        }
      } else if (tab.apiPath) {
        if (mode === "create") {
          // Avoid duplicate identity codes (e.g. BR-001 already used)
          let createForm = { ...form };
          if (codeKey && createForm[codeKey]) {
            const existing = new Set(
              rows.flatMap((r) =>
                [r[codeKey], r.code].map((v) => String(v ?? "").toUpperCase()).filter(Boolean),
              ),
            );
            let code = String(createForm[codeKey]);
            if (existing.has(code.toUpperCase())) {
              code = nextCode(tab.codePrefix ?? "CFG", Array.from(existing));
              createForm = { ...createForm, [codeKey]: code };
            }
          }
          const body = buildCreateBody ? buildCreateBody(createForm) : createForm;
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
            const res = await resourceService.delete(tab.apiPath, id);
            if (ids.length === 1 && res.message && res.message !== "OK") {
              toast(res.message, "success");
              setConfirm(null);
              await load();
              return;
            }
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

  const readOnly = mode === "view" || tab.source === "derived";
  const canCreate = tab.source !== "derived";

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{tab.title}</h2>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {tab.source === "api" ? "Live API" : tab.source === "local" ? "Config store" : "Derived"}
            </Badge>
          </div>
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
              Add {singularTabTitle(tab.title)}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2">
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
              Add {singularTabTitle(tab.title)}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="w-full max-w-full overflow-x-hidden">
            <table className="w-full max-w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col style={{ width: "5%" }} />
                {columnWidths.map((w, i) => (
                  <col key={columns[i]?.key ?? i} style={{ width: w }} />
                ))}
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40">
                  <th className="overflow-hidden px-2 py-2.5 sm:px-3">
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
                      className="overflow-hidden px-2 py-2.5 text-[11px] font-medium tracking-wide text-ellipsis whitespace-nowrap text-muted-foreground uppercase sm:px-3"
                      title={c.label}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="overflow-hidden px-2 py-2.5 text-right text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase sm:px-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="overflow-hidden px-2 py-2 sm:px-3">
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
                      <td key={c.key} className="max-w-0 overflow-hidden px-2 py-2.5 align-middle sm:px-3">
                        {c.render
                          ? <div className="min-w-0 truncate">{c.render(row)}</div>
                          : c.key === "status"
                            ? (
                              <div className="min-w-0 truncate">
                                <HrStatusBadge status={cell(row, "status")} />
                              </div>
                            )
                            : c.key === "head"
                              ? (() => {
                                  const label = resolveEmployeeLabel(
                                    row.head ?? row.head_employee_id,
                                    orgLookups.employees,
                                  );
                                  return (
                                    <span className="block truncate" title={label}>
                                      {label}
                                    </span>
                                  );
                                })()
                            : (
                              <span className="block truncate" title={cell(row, c.key, ...nameKeys)}>
                                {cell(row, c.key, ...nameKeys)}
                              </span>
                            )}
                      </td>
                    ))}
                    <td className="overflow-hidden px-2 py-2 text-right align-middle sm:px-3">
                      <RowActionsMenu
                        open={menuId === row.id}
                        onOpenChange={(open) => setMenuId(open ? row.id : null)}
                        buttonSize="icon-xs"
                      >
                        <RowActionsItem
                          onClick={() => {
                            setMenuId(null);
                            openEdit(row, true);
                          }}
                        >
                          <Eye className="size-3.5 text-muted-foreground" />
                          View
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuId(null);
                            openEdit(row);
                          }}
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                          Edit
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuId(null);
                            openHistory(row);
                          }}
                        >
                          <History className="size-3.5 text-muted-foreground" />
                          History
                        </RowActionsItem>
                        <RowActionsItem
                          onClick={() => {
                            setMenuId(null);
                            setConfirm({ type: "archive", ids: [row.id] });
                          }}
                        >
                          <Archive className="size-3.5 text-muted-foreground" />
                          Archive
                        </RowActionsItem>
                        <RowActionsItem
                          destructive
                          onClick={() => {
                            setMenuId(null);
                            setConfirm({ type: "delete", ids: [row.id] });
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
          <div className="flex w-full items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
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
            ? `Add ${singularTabTitle(tab.title)}`
            : mode === "view"
              ? `View ${singularTabTitle(tab.title)}`
              : `Edit ${singularTabTitle(tab.title)}`
        }
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
            <div
              key={f.key}
              className={
                f.type === "textarea" || f.type === "equipment_list" ? "sm:col-span-2" : undefined
              }
            >
              <SetupField label={f.label} required={f.required} hint={f.hint}>
                {f.type === "equipment_list" ? (
                  <RoomEquipmentEditor
                    value={form[f.key] ?? "[]"}
                    disabled={readOnly || f.readOnly}
                    onChange={(json) => setForm((prev) => ({ ...prev, [f.key]: json }))}
                  />
                ) : f.type === "textarea" ? (
                  <SetupTextarea
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                ) : f.type === "searchable" ? (
                  <SearchableSelect
                    value={form[f.key] ?? ""}
                    disabled={readOnly || f.readOnly}
                    options={resolveFieldOptions(f)}
                    placeholder={f.placeholder || (f.required ? "Select…" : "None")}
                    searchPlaceholder={`Search ${f.label.toLowerCase()}…`}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, [f.key]: value }))
                    }
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
                  <div className="flex h-8 items-center gap-2 text-sm">
                    <input
                      id={`setup-cb-${f.key}`}
                      type="checkbox"
                      className="cursor-pointer"
                      checked={isFormChecked(form[f.key])}
                      disabled={readOnly || f.readOnly}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [f.key]: e.target.checked ? "true" : "false" }))
                      }
                    />
                    <label htmlFor={`setup-cb-${f.key}`} className="cursor-pointer text-muted-foreground">
                      Enabled
                    </label>
                  </div>
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
        {active ? <AuditBlock row={active} usersById={usersById} /> : null}
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
            <AuditBlock row={active} usersById={usersById} />
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
