"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";

import { AssignmentCheckboxCell } from "@/components/organization/assignment-checkbox-cell";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { erpModules } from "@/config/modules";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  createDepartment,
  listBranchOptions,
  listCompanyOptions,
  listDepartments,
  updateDepartmentModules,
  type OrgBranchOption,
  type OrgCompanyOption,
  type OrgDepartment,
} from "@/services/organization-departments-service";

const ASSIGNABLE_MODULES = erpModules.map((m) => ({ id: m.key, label: m.title }));

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function OrganizationDepartmentsPage() {
  const [rows, setRows] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [branches, setBranches] = useState<OrgBranchOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [createModuleKeys, setCreateModuleKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, companyOpts] = await Promise.all([listDepartments(), listCompanyOptions()]);
      setRows(depts);
      setCompanies(companyOpts);
      setCompanyId((prev) => prev || companyOpts[0]?.id || "");
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load departments"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!companyId) {
        setBranches([]);
        setBranchId("");
        return;
      }
      const opts = await listBranchOptions(companyId);
      if (cancelled) return;
      setBranches(opts);
      setBranchId((prev) => (opts.some((b) => b.id === prev) ? prev : opts[0]?.id ?? ""));
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const modules = (row.module_keys ?? [])
        .map((k) => ASSIGNABLE_MODULES.find((m) => m.id === k)?.label ?? k)
        .join(" ")
        .toLowerCase();
      return (
        row.department_name.toLowerCase().includes(q) ||
        row.department_code.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        modules.includes(q)
      );
    });
  }, [rows, query]);

  async function submitAdd() {
    setFormError(null);
    const name = departmentName.trim();
    const code = departmentCode.trim().toUpperCase();
    if (!name) {
      setFormError("Department name is required.");
      return;
    }
    if (!code) {
      setFormError("Department code is required.");
      return;
    }
    if (!companyId || !branchId) {
      setFormError("Company and branch are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await createDepartment({
        company_id: companyId,
        branch_id: branchId,
        department_code: code,
        department_name: name,
        module_keys: createModuleKeys,
      });
      setRows((prev) => [...prev, created].sort((a, b) => a.department_name.localeCompare(b.department_name)));
      setDepartmentName("");
      setDepartmentCode("");
      setCreateModuleKeys([]);
      setShowAdd(false);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? formatApiError(err, "Failed to create department")
          : err instanceof Error
            ? err.message
            : "Failed to create department",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Departments"
        description="Create departments and map ERP modules (HR, Procurement, Marketing, and more)."
        backHref="/organization"
        backLabel="Back to Organization"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={loading}
              onClick={() => void load()}
              aria-label="Refresh departments"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              onClick={() => {
                setFormError(null);
                setShowAdd((v) => !v);
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Add department
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Records</p>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {loading ? "…" : `${filtered.length} shown`}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Live data from <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/departments</code>
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter departments…"
            className="h-9 w-full max-w-xs border-border/80 bg-background transition-colors duration-200"
            aria-label="Filter departments"
          />
        </div>

        {showAdd ? (
          <div className="space-y-3 border-b border-border/70 bg-muted/15 px-4 py-3">
            <p className="text-[12px] font-medium text-foreground">New department</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <Input
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Department name"
                className="h-9"
                disabled={saving}
                aria-label="Department name"
              />
              <Input
                value={departmentCode}
                onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
                placeholder="Code (e.g. MKT)"
                className="h-9"
                disabled={saving}
                aria-label="Department code"
              />
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-9 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                disabled={saving || companies.length === 0}
                aria-label="Company"
              >
                {companies.length === 0 ? <option value="">No companies</option> : null}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-9 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                disabled={saving || branches.length === 0}
                aria-label="Branch"
              >
                {branches.length === 0 ? <option value="">No branches</option> : null}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="erp-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-background p-2">
              <p className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">
                Map modules (optional)
              </p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {ASSIGNABLE_MODULES.map((mod) => {
                  const checked = createModuleKeys.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-muted/80"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 cursor-pointer accent-primary"
                        checked={checked}
                        disabled={saving}
                        onChange={() => {
                          setCreateModuleKeys((prev) =>
                            checked ? prev.filter((k) => k !== mod.id) : [...prev, mod.id],
                          );
                        }}
                      />
                      <span className="font-medium text-foreground">{mod.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={saving}
                onClick={() => void submitAdd()}
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {saving ? "Saving…" : "Save department"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 cursor-pointer transition-colors duration-200"
                disabled={saving}
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
            </div>
            {formError ? <p className="text-[12px] text-destructive">{formError}</p> : null}
          </div>
        ) : null}

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Department name</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Modules</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Updated at</th>
                <th className="px-4 py-2.5">Created at</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading departments…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {query.trim() ? "No departments match your filter." : "No departments yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.department_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.department_code}</td>
                    <td className="px-4 py-2.5">
                      <AssignmentCheckboxCell
                        label="Modules"
                        options={ASSIGNABLE_MODULES}
                        selectedIds={row.module_keys ?? []}
                        canEdit
                        emptyLabel="No modules"
                        onSave={async (ids) => {
                          const updated = await updateDepartmentModules(row.id, ids);
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)),
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatWhen(row.updated_at)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatWhen(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
