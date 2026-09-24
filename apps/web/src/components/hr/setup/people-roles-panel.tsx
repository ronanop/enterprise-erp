"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { toast } from "@/components/hr/setup/setup-toast";
import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ApiClientError } from "@/services/api-client";
import {
  listPeopleRoles,
  updatePeopleRole,
  type PeopleRolePatch,
  type PeopleRoleRow,
} from "@/services/people-role-service";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | "manager" | "recruiter" | "hr";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normId(id: string | null | undefined): string {
  return String(id ?? "").trim().toLowerCase();
}

function personLabel(name: string, code?: string | null, manager?: boolean): string {
  const n = name.trim();
  const c = (code ?? "").trim();
  const base = c && !n.includes(c) ? `${n} (${c})` : n;
  return manager ? `${base} · manager` : base;
}

function reportingManagerLabel(row: PeopleRoleRow, all: PeopleRoleRow[]): string {
  const id = normId(row.reporting_manager_id);
  if (!id) return "";
  const match = all.find((r) => normId(r.id) === id);
  if (match) return personLabel(match.display_name, match.employee_code, match.is_hiring_manager);
  const name = (row.reporting_manager_name ?? "").trim();
  if (name && !UUID_RE.test(name)) {
    return personLabel(name, row.reporting_manager_code, true);
  }
  return "Unknown manager";
}

function RoleToggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px] transition-colors duration-200",
        checked
          ? "border-[#2563EB]/30 bg-[#2563EB]/8 text-[#1E293B]"
          : "border-border/80 bg-white text-muted-foreground hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        className="size-3.5 cursor-pointer accent-[#2563EB]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function PeopleRolesPanel() {
  const [rows, setRows] = useState<PeopleRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPeopleRoles());
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to load people roles", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const managerOptions = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            Number(b.is_hiring_manager) - Number(a.is_hiring_manager) ||
            a.display_name.localeCompare(b.display_name),
        )
        .map((r) => ({
          value: normId(r.id),
          label: personLabel(r.display_name, r.employee_code, r.is_hiring_manager),
        })),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "manager" && !row.is_hiring_manager) return false;
      if (filter === "recruiter" && !row.is_recruiter) return false;
      if (filter === "hr" && !row.is_hr) return false;
      if (!q) return true;
      const blob = [
        row.display_name,
        row.employee_code,
        row.designation,
        row.reporting_manager_name,
        ...(row.role_codes ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, query, filter]);

  async function patch(row: PeopleRoleRow, body: PeopleRolePatch) {
    setSavingId(row.id);
    try {
      const next = await updatePeopleRole(row.id, body);
      setRows((prev) => prev.map((r) => (r.id === row.id ? next : r)));
      if (body.reporting_manager_id) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === body.reporting_manager_id ? { ...r, is_hiring_manager: true } : r,
          ),
        );
      }
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not save role", "error");
    } finally {
      setSavingId(null);
    }
  }

  const filters: { id: RoleFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "manager", label: "Hiring managers" },
    { id: "recruiter", label: "Recruiters" },
    { id: "hr", label: "HR" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        Tick who is a hiring manager, recruiter, or HR. Leave and team approvals still go to the
        assigned reporting manager. HR also gets the HR_MANAGER login pack so they can approve in
        the ESS inbox.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code, or designation…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-200",
                filter === f.id
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-border bg-white text-muted-foreground hover:bg-muted/50",
              )}
            >
              {f.label}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-white">
        <div className="erp-scroll max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Reporting manager</th>
                <th className="px-3 py-2">Reports</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Login / RBAC</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No employees match.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const busy = savingId === row.id;
                  const selectedMgrId = normId(row.reporting_manager_id);
                  const mgrLabel = reportingManagerLabel(row, rows);
                  const mgrOptions = [
                    { value: "", label: "None" },
                    ...managerOptions.filter((o) => o.value !== normId(row.id)),
                  ];
                  if (selectedMgrId && !mgrOptions.some((o) => o.value === selectedMgrId)) {
                    mgrOptions.push({ value: selectedMgrId, label: mgrLabel });
                  }
                  return (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-[#1E293B]">{row.display_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.employee_code} · {row.designation || "—"}
                        </div>
                      </td>
                      <td className="w-[260px] px-3 py-2 align-top">
                        <SearchableSelect
                          value={selectedMgrId}
                          disabled={busy}
                          allowCustomValue={false}
                          placeholder="Assign manager…"
                          searchPlaceholder="Type a name…"
                          options={mgrOptions}
                          onChange={(value) => {
                            if (!value) {
                              void patch(row, { clear_reporting_manager: true });
                              return;
                            }
                            void patch(row, { reporting_manager_id: value });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">
                        {row.reports_count}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <RoleToggle
                            checked={row.is_hiring_manager}
                            disabled={busy}
                            label="Hiring manager"
                            onChange={(next) => void patch(row, { is_hiring_manager: next })}
                          />
                          <RoleToggle
                            checked={row.is_recruiter}
                            disabled={busy}
                            label="Recruiter"
                            onChange={(next) => void patch(row, { is_recruiter: next })}
                          />
                          <RoleToggle
                            checked={row.is_hr}
                            disabled={busy}
                            label="HR"
                            onChange={(next) => void patch(row, { is_hr: next })}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">
                        {row.has_login ? (
                          <span>{row.role_codes.length ? row.role_codes.join(", ") : "Login linked"}</span>
                        ) : (
                          <span>No login</span>
                        )}
                        {row.hr_note ? (
                          <span className="mt-0.5 block text-[#B45309]">{row.hr_note}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <HrStatusBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          Showing {filtered.length} of {rows.length}
        </div>
      </div>
    </div>
  );
}
