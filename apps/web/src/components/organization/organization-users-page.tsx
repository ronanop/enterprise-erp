"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown, RefreshCw, ShieldCheck, UserRound, Users } from "lucide-react";

import { UserAvatar } from "@/components/layout/user-avatar";
import { UserMemberModulesCell } from "@/components/organization/user-member-modules-cell";
import { UserModulesCell } from "@/components/organization/user-modules-cell";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  canManageUserModules,
  isModuleAdmin,
  moduleTitle,
} from "@/lib/module-access";
import {
  hasModuleMemberAssignment,
  memberOnlyModuleKeys,
} from "@/lib/module-membership";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  listFoundationUsers,
  syncM365OrganizationUsers,
  type FoundationUser,
} from "@/services/foundation-users-service";

function sortUsersByName(users: FoundationUser[]): FoundationUser[] {
  return [...users].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
}

function filterUsers(rows: FoundationUser[], query: string): FoundationUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const assigned = row.assigned_module_keys ?? [];
    const admins = row.admin_module_keys ?? [];
    const members = memberOnlyModuleKeys(assigned, admins);
    return (
      row.display_name.toLowerCase().includes(q) ||
      row.email.toLowerCase().includes(q) ||
      row.user_type.toLowerCase().includes(q) ||
      assigned.some((k) => moduleTitle(k).toLowerCase().includes(q)) ||
      admins.some((k) => moduleTitle(k).toLowerCase().includes(q)) ||
      members.some((k) => moduleTitle(k).toLowerCase().includes(q))
    );
  });
}

/** Platform ERP admins (super_admin / tenant_admin) — not per-module admins. */
function isErpAdminUser(userType: string): boolean {
  return isModuleAdmin(userType);
}

/** Module-level admins only (excludes ERP platform admins). */
function isModuleAdminUser(row: FoundationUser): boolean {
  if (isErpAdminUser(row.user_type)) return false;
  return (row.admin_module_keys ?? []).length > 0;
}

type TableVariant = "erp" | "admin" | "member";

function UsersTableCard({
  title,
  subtitle,
  icon,
  toolbar,
  loading,
  emptyLabel,
  rows,
  variant,
  canEditModules,
  onModulesSaved,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  toolbar?: ReactNode;
  loading: boolean;
  emptyLabel: string;
  rows: FoundationUser[];
  variant: TableVariant;
  canEditModules: boolean;
  onModulesSaved: (
    userId: string,
    assigned_module_keys: string[],
    admin_module_keys: string[],
  ) => void;
}) {
  const modulesColumnLabel =
    variant === "member"
      ? "Module membership"
      : variant === "erp"
        ? "Access"
        : "Module admins";

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {toolbar}
      </div>

      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">{modulesColumnLabel}</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        displayName={row.display_name}
                        size="sm"
                        className="!size-8 !text-[10px]"
                      />
                      <span className="font-medium text-foreground">{row.display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.email}</td>
                  <td className="px-4 py-2.5">
                    {variant === "member" ? (
                      <UserMemberModulesCell
                        assignedModuleKeys={row.assigned_module_keys ?? []}
                        adminModuleKeys={row.admin_module_keys ?? []}
                      />
                    ) : (
                      <UserModulesCell
                        userId={row.id}
                        userType={row.user_type}
                        assignedModuleKeys={row.assigned_module_keys ?? []}
                        adminModuleKeys={row.admin_module_keys ?? []}
                        canEdit={canEditModules && variant !== "erp"}
                        onSaved={(assigned_module_keys, admin_module_keys) => {
                          onModulesSaved(row.id, assigned_module_keys, admin_module_keys);
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <FinanceStatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrganizationUsersPage({
  title = "Organization users",
  description = "ERP admins, module admins, module members, and Entra users without module assignment.",
  backHref,
  backLabel,
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
} = {}) {
  const { user: sessionUser, permissions } = useAuthUser();
  const canEditModules = canManageUserModules(permissions, sessionUser?.userType);
  const [rows, setRows] = useState<FoundationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erpQuery, setErpQuery] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [unassignedQuery, setUnassignedQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listFoundationUsers());
    } catch (err) {
      setRows([]);
      if (err instanceof ApiClientError) {
        const hint =
          err.status === 0
            ? "Cannot reach the API. Confirm the backend is running on port 8000."
            : err.message;
        setError(hint);
      } else {
        setError("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSyncM365 = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await syncM365OrganizationUsers();
      setSyncMessage(
        `Synced @${result.domain}: ${result.directory_count} users (${result.created} created, ${result.updated} updated).`,
      );
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSyncError(err.message);
      } else {
        setSyncError("Microsoft 365 sync failed.");
      }
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const erpAdmins = useMemo(() => {
    const list = rows.filter((row) => isErpAdminUser(row.user_type));
    return sortUsersByName(filterUsers(list, erpQuery));
  }, [rows, erpQuery]);

  const adminUsers = useMemo(() => {
    const list = rows.filter((row) => isModuleAdminUser(row));
    return sortUsersByName(filterUsers(list, adminQuery));
  }, [rows, adminQuery]);

  const memberUsers = useMemo(() => {
    const list = rows.filter((row) =>
      hasModuleMemberAssignment(
        row.user_type,
        row.assigned_module_keys ?? [],
        row.admin_module_keys ?? [],
      ),
    );
    return sortUsersByName(filterUsers(list, memberQuery));
  }, [rows, memberQuery]);

  const unassignedUsers = useMemo(() => {
    const list = rows.filter(
      (row) =>
        !isErpAdminUser(row.user_type) &&
        !isModuleAdminUser(row) &&
        !hasModuleMemberAssignment(
          row.user_type,
          row.assigned_module_keys ?? [],
          row.admin_module_keys ?? [],
        ),
    );
    return sortUsersByName(filterUsers(list, unassignedQuery));
  }, [rows, unassignedQuery]);

  function onModulesSaved(
    userId: string,
    assigned_module_keys: string[],
    admin_module_keys: string[],
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === userId ? { ...r, assigned_module_keys, admin_module_keys } : r,
      ),
    );
  }

  const erpSearchInput = (
    <Input
      value={erpQuery}
      onChange={(e) => setErpQuery(e.target.value)}
      placeholder="Search name or email…"
      className="h-9 w-full min-w-[200px] max-w-xs cursor-pointer"
      aria-label="Search ERP admins"
    />
  );

  const adminSearchInput = (
    <Input
      value={adminQuery}
      onChange={(e) => setAdminQuery(e.target.value)}
      placeholder="Search name or email…"
      className="h-9 w-full min-w-[200px] max-w-xs cursor-pointer"
      aria-label="Search module admin users"
    />
  );

  const memberSearchInput = (
    <Input
      value={memberQuery}
      onChange={(e) => setMemberQuery(e.target.value)}
      placeholder="Search name or email…"
      className="h-9 w-full min-w-[200px] max-w-xs cursor-pointer"
      aria-label="Search module member users"
    />
  );

  const unassignedToolbar = (
    <div className="flex flex-nowrap items-center gap-2">
      <Input
        value={unassignedQuery}
        onChange={(e) => setUnassignedQuery(e.target.value)}
        placeholder="Search name or email…"
        className="h-9 w-[200px] shrink-0 cursor-pointer sm:w-64"
        aria-label="Search users without module assignment"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 cursor-pointer gap-1.5"
        disabled={syncing || !canEditModules}
        onClick={() => void onSyncM365()}
      >
        <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden />
        {syncing ? "Syncing…" : "Sync Entra"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        backHref={backHref}
        backLabel={backLabel}
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {syncError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {syncError}
        </div>
      ) : null}

      {syncMessage ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground">
          {syncMessage}
        </div>
      ) : null}

      <UsersTableCard
        title="ERP admins"
        subtitle={
          loading ? "Loading…" : `${erpAdmins.length} platform admin${erpAdmins.length === 1 ? "" : "s"}`
        }
        icon={<Crown className="size-4" />}
        toolbar={erpSearchInput}
        loading={loading}
        emptyLabel={
          erpQuery.trim() ? "No ERP admins match your search." : "No ERP admins found."
        }
        rows={erpAdmins}
        variant="erp"
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />

      <UsersTableCard
        title="Module admin users"
        subtitle={
          loading ? "Loading…" : `${adminUsers.length} with module admin rights`
        }
        icon={<ShieldCheck className="size-4" />}
        toolbar={adminSearchInput}
        loading={loading}
        emptyLabel={
          adminQuery.trim()
            ? "No module admin users match your search."
            : "No module admins assigned yet."
        }
        rows={adminUsers}
        variant="admin"
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />

      <UsersTableCard
        title="Module users"
        subtitle={
          loading
            ? "Loading…"
            : `${memberUsers.length} with member access (managed in module panels)`
        }
        icon={<UserRound className="size-4" />}
        toolbar={memberSearchInput}
        loading={loading}
        emptyLabel={
          memberQuery.trim()
            ? "No module users match your search."
            : "No module members assigned yet."
        }
        rows={memberUsers}
        variant="member"
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />

      <UsersTableCard
        title="Non-assigned users"
        subtitle={
          loading
            ? "Loading…"
            : `${unassignedUsers.length} Entra users without module assignment`
        }
        icon={<Users className="size-4" />}
        toolbar={unassignedToolbar}
        loading={loading}
        emptyLabel={
          unassignedQuery.trim()
            ? "No unassigned users match your search."
            : "Every user has a module assignment."
        }
        rows={unassignedUsers}
        variant="admin"
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />
    </div>
  );
}
