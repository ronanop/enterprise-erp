"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { UserAvatar } from "@/components/layout/user-avatar";
import { UserModulesCell } from "@/components/organization/user-modules-cell";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageUserModules, moduleTitle } from "@/lib/module-access";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { listFoundationUsers, type FoundationUser } from "@/services/foundation-users-service";

export function OrganizationUsersPage() {
  const { user: sessionUser, permissions } = useAuthUser();
  const canEditModules = canManageUserModules(permissions, sessionUser?.userType);
  const [rows, setRows] = useState<FoundationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.display_name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.user_type.toLowerCase().includes(q) ||
        (row.assigned_module_keys ?? []).some((k) => moduleTitle(k).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization users"
        description="Assign ERP modules per user. Users only see assigned module hubs in the sidebar (admins see all)."
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Users</p>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length} shown`}
              </p>
            </div>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-9 max-w-xs"
            aria-label="Search users"
          />
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Modules</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No users match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar displayName={row.display_name} size="sm" className="!size-8 !text-[10px]" />
                        <span className="font-medium text-foreground">{row.display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.email}</td>
                    <td className="px-4 py-2.5">
                      <UserModulesCell
                        userId={row.id}
                        userType={row.user_type}
                        assignedModuleKeys={row.assigned_module_keys ?? []}
                        canEdit={canEditModules}
                        onSaved={(assigned_module_keys) => {
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, assigned_module_keys } : r,
                            ),
                          );
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
    </div>
  );
}
