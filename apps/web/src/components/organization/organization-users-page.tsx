"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ShieldCheck, Users } from "lucide-react";

import { UserAvatar } from "@/components/layout/user-avatar";
import { UserModulesCell } from "@/components/organization/user-modules-cell";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageUserModules, isModuleAdmin, moduleTitle } from "@/lib/module-access";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { listFoundationUsers, type FoundationUser } from "@/services/foundation-users-service";

function hasModuleAssignment(row: FoundationUser): boolean {
  if (isModuleAdmin(row.user_type)) return true;
  const assigned = row.assigned_module_keys ?? [];
  const admins = row.admin_module_keys ?? [];
  return assigned.length > 0 || admins.length > 0;
}

function sortUsersByName(users: FoundationUser[]): FoundationUser[] {
  return [...users].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
}

function filterUsers(rows: FoundationUser[], query: string): FoundationUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.display_name.toLowerCase().includes(q) ||
      row.email.toLowerCase().includes(q) ||
      row.user_type.toLowerCase().includes(q) ||
      (row.assigned_module_keys ?? []).some((k) => moduleTitle(k).toLowerCase().includes(q)) ||
      (row.admin_module_keys ?? []).some((k) => moduleTitle(k).toLowerCase().includes(q)),
  );
}

function UsersTableCard({
  title,
  subtitle,
  icon,
  toolbar,
  loading,
  emptyLabel,
  rows,
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
  canEditModules: boolean;
  onModulesSaved: (
    userId: string,
    assigned_module_keys: string[],
    admin_module_keys: string[],
  ) => void;
}) {
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
              <th className="px-4 py-2.5">Module admins</th>
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
                    <UserModulesCell
                      userId={row.id}
                      userType={row.user_type}
                      assignedModuleKeys={row.assigned_module_keys ?? []}
                      adminModuleKeys={row.admin_module_keys ?? []}
                      canEdit={canEditModules}
                      onSaved={(assigned_module_keys, admin_module_keys) => {
                        onModulesSaved(row.id, assigned_module_keys, admin_module_keys);
                      }}
                    />
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

export function OrganizationUsersPage() {
  const { user: sessionUser, permissions } = useAuthUser();
  const canEditModules = canManageUserModules(permissions, sessionUser?.userType);
  const [rows, setRows] = useState<FoundationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedQuery, setAssignedQuery] = useState("");
  const [unassignedQuery, setUnassignedQuery] = useState("");

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

  const assignedUsers = useMemo(() => {
    const list = rows.filter((row) => hasModuleAssignment(row));
    return sortUsersByName(filterUsers(list, assignedQuery));
  }, [rows, assignedQuery]);

  const unassignedUsers = useMemo(() => {
    const list = rows.filter((row) => !hasModuleAssignment(row));
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

  const assignedSearchInput = (
    <Input
      value={assignedQuery}
      onChange={(e) => setAssignedQuery(e.target.value)}
      placeholder="Search name or email…"
      className="h-9 w-full min-w-[200px] max-w-xs"
      aria-label="Search module-assigned users"
    />
  );

  const unassignedSearchInput = (
    <Input
      value={unassignedQuery}
      onChange={(e) => setUnassignedQuery(e.target.value)}
      placeholder="Search name or email…"
      className="h-9 w-full min-w-[200px] max-w-xs"
      aria-label="Search users without module assignment"
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization users"
        description="Assign module admins. Each admin gets that module’s full ERP panel and can add module users from a Users tab."
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <UsersTableCard
        title="Module assigned users"
        subtitle={
          loading
            ? "Loading…"
            : `${assignedUsers.length} with module access or module admin rights`
        }
        icon={<ShieldCheck className="size-4" />}
        toolbar={assignedSearchInput}
        loading={loading}
        emptyLabel={
          assignedQuery.trim()
            ? "No module-assigned users match your search."
            : "No users have module assignments yet."
        }
        rows={assignedUsers}
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />

      <UsersTableCard
        title="All other users"
        subtitle={
          loading
            ? "Loading…"
            : `${unassignedUsers.length} without module assignment`
        }
        icon={<Users className="size-4" />}
        toolbar={unassignedSearchInput}
        loading={loading}
        emptyLabel={
          unassignedQuery.trim()
            ? "No unassigned users match your search."
            : "Every user has a module assignment."
        }
        rows={unassignedUsers}
        canEditModules={canEditModules}
        onModulesSaved={onModulesSaved}
      />
    </div>
  );
}
