"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, ScrollText, Shield, UserPlus } from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrLoadingBlock,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import {
  assignHrAdmin,
  listHrActivityLogs,
  listHrAdmins,
  resetHrAdminPassword,
  revokeHrAdmin,
  type HrActivityLogRecord,
  type HrAdminRecord,
} from "@/services/hr-superadmin-service";
import type { EmployeeRecord } from "@/types/employee-management";
import { ApiClientError } from "@/services/api-client";

type IssuedLogin = {
  name: string;
  email: string;
  password: string;
};

type TabId = "assign" | "passwords" | "logs";

const TABS: HrTabItem[] = [
  { id: "assign", label: "Assign HR", icon: UserPlus },
  { id: "passwords", label: "Passwords", icon: KeyRound },
  { id: "logs", label: "Activity logs", icon: ScrollText },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ToggleSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#9B5BB8]" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </button>
  );
}

export function HrSuperadminPage() {
  const { isHrmsSuperAdmin, loading: permLoading } = useUserPermissions();
  const [tab, setTab] = useState<TabId>("assign");
  const [query, setQuery] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [admins, setAdmins] = useState<HrAdminRecord[]>([]);
  const [logs, setLogs] = useState<HrActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLogin | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, adminRows] = await Promise.all([loadEmployeeDirectory(), listHrAdmins()]);
      setEmployees(dir.records.filter((r) => !r.isDeleted));
      setAdmins(adminRows);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load Superadmin data";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      setLogs(await listHrActivityLogs(200));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load activity logs";
      toast(message, "error");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || permLoading || !isHrmsSuperAdmin) return;
    void reload();
    void reloadLogs();
  }, [permLoading, isHrmsSuperAdmin, reload, reloadLogs]);

  const adminIds = useMemo(() => new Set(admins.map((a) => a.employee_id)), [admins]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.officialEmail.toLowerCase().includes(q) ||
        e.designationName.toLowerCase().includes(q),
    );
  }, [employees, query]);

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (row) =>
        row.action.toLowerCase().includes(q) ||
        (row.entity_name ?? "").toLowerCase().includes(q) ||
        (row.actor_name ?? "").toLowerCase().includes(q) ||
        (row.actor_email ?? "").toLowerCase().includes(q) ||
        row.summary.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q),
    );
  }, [logs, logQuery]);

  function showIssued(name: string, email: string, password: string | null | undefined) {
    if (!password) return;
    setIssued({ name, email, password });
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`);
    } catch {
      toast(`Could not copy ${label}`, "error");
    }
  }

  async function onToggleHr(employeeId: string, next: boolean) {
    setBusyId(employeeId);
    try {
      if (next) {
        const row = await assignHrAdmin(employeeId);
        if (row.temporary_password) {
          showIssued(row.display_name, row.email, row.temporary_password);
          toast(`${row.display_name} is now HR Admin. Copy the generated password below.`);
          setTab("passwords");
        } else {
          toast(`${row.display_name} is now HR Admin`);
        }
      } else {
        await revokeHrAdmin(employeeId);
        toast("HR Admin access revoked");
      }
      await Promise.all([reload(), reloadLogs()]);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : next ? "Assign failed" : "Revoke failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onGeneratePassword(employeeId: string) {
    setBusyId(employeeId);
    try {
      const row = await resetHrAdminPassword(employeeId);
      showIssued(row.display_name, row.email, row.temporary_password);
      toast(`New password generated for ${row.display_name}`);
      await reloadLogs();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Password generation failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAuthenticated()) return <HrAuthBanner />;
  if (permLoading) return <HrLoadingBlock label="Checking access…" />;
  if (!isHrmsSuperAdmin) {
    return (
      <div className="p-6">
        <HrEmptyState
          title="Superadmin Panel"
          description="Only the HRMS Superadmin can assign HR Admins. This page is hidden from HR Admin users."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <SetupToastHost />
      <PageHeader
        title="Superadmin Panel"
        description="Assign HR Admins, generate their login passwords, and review activity logs. HR Admins get the full HRMS sidebar except this panel."
      />

      {issued ? (
        <div className="rounded-2xl border border-[#9B5BB8]/40 bg-[#9B5BB8]/8 p-4 shadow-sm">
          <p className="text-sm font-medium">HR login password (shown once)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this with {issued.name}. They should change it after first sign-in.
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-medium">
                <span className="truncate">{issued.email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => void copyText(issued.email, "Email")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Password</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-mono text-sm font-medium">
                <span className="truncate">{issued.password}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => void copyText(issued.password, "Password")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <HrUnderlineTabs
        tabs={TABS.map((t) =>
          t.id === "assign"
            ? { ...t, badge: admins.length || undefined }
            : t,
        )}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "assign" ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4 text-[#9B5BB8]" />
              Employees
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, code, email…"
              className="max-w-xs"
            />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Turn on HR Admin to grant access. Turn off to revoke.
          </p>
          {loading ? (
            <HrLoadingBlock label="Loading employees…" />
          ) : filtered.length === 0 ? (
            <HrEmptyState title="No employees match" description="Try a different search." />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((emp) => {
                const isAdmin = adminIds.has(emp.id);
                return (
                  <li key={emp.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{emp.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.employeeCode} · {emp.officialEmail} · {emp.designationName || "—"}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={isAdmin}
                      disabled={busyId === emp.id}
                      label={isAdmin ? "HR Admin" : "Assign HR"}
                      onChange={(next) => void onToggleHr(emp.id, next)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "passwords" ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-[#9B5BB8]" />
            HR Admin passwords ({admins.length})
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Turn on Generate to create a random login password. It is shown once above.
          </p>
          {admins.length === 0 ? (
            <HrEmptyState
              title="No HR Admins yet"
              description="Assign someone as HR Admin first, then generate their password here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {admins.map((row) => (
                <li key={row.employee_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{row.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employee_code} · {row.email} · {row.designation || "—"}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={issued?.email === row.email}
                    disabled={busyId === row.employee_id}
                    label="Generate password"
                    onChange={(next) => {
                      if (next) void onGeneratePassword(row.employee_id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScrollText className="size-4 text-[#9B5BB8]" />
              Activity logs
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="Filter logs…"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void reloadLogs()}>
                Refresh
              </Button>
            </div>
          </div>
          {logsLoading ? (
            <HrLoadingBlock label="Loading activity logs…" />
          ) : filteredLogs.length === 0 ? (
            <HrEmptyState
              title="No activity yet"
              description="Assignments, password resets, and other changes will show here."
            />
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatWhen(row.occurred_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                          {row.kind}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {row.action}
                        {row.entity_name ? (
                          <span className="ml-1 font-normal text-muted-foreground">· {row.entity_name}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <p>{row.actor_name || "—"}</p>
                        {row.actor_email ? (
                          <p className="text-[10px] text-muted-foreground">{row.actor_email}</p>
                        ) : null}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={row.summary}>
                        {row.summary || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
