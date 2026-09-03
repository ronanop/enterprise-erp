"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { UserAvatar } from "@/components/layout/user-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageModuleUsers, moduleTitle } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  addModuleMember,
  listAssignableModuleUsers,
  listModuleMembers,
  removeModuleMember,
  type ModuleUserOption,
  type ModuleUserRecord,
} from "@/services/module-users-service";

type Props = {
  moduleKey: string;
};

export function ModuleUsersPage({ moduleKey }: Props) {
  const router = useRouter();
  const { user, adminModuleKeys, loading: authLoading } = useAuthUser();
  const allowed = canManageModuleUsers(moduleKey, adminModuleKeys, user?.userType);
  const title = moduleTitle(moduleKey);

  const [members, setMembers] = useState<ModuleUserRecord[]>([]);
  const [options, setOptions] = useState<ModuleUserOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberRows, assignable] = await Promise.all([
        listModuleMembers(moduleKey),
        listAssignableModuleUsers(moduleKey),
      ]);
      setMembers(memberRows);
      setOptions(assignable);
      setSelectedId("");
    } catch (err) {
      setMembers([]);
      setOptions([]);
      setError(formatApiError(err, "Failed to load module users"));
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) {
      router.replace(`/${moduleKey}`);
      return;
    }
    void load();
  }, [allowed, authLoading, load, moduleKey, router]);

  async function assignSelected() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await addModuleMember(moduleKey, selectedId);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not assign user"));
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(userId: string) {
    setSaving(true);
    setError(null);
    try {
      await removeModuleMember(moduleKey, userId);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not remove user"));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !allowed) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={moduleKey === "service" ? "Service team" : "Users"}
        description={
          moduleKey === "service"
            ? "As Service Head, assign Entra users as Service Engineers. They get the Service module and can work tickets you assign. Module admins (Service Head) are set by the ERP admin under Organization → Users."
            : `Assign Entra users to ${title}. Assigned users see this module in their ERP menu. Users who already have ${title} are hidden from the dropdown.`
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {moduleKey === "service" ? "Service engineers" : "Module users"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {loading ? "Loading…" : `${members.length} assigned`}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${moduleKey}-assign-user`}>
              Select Entra user
            </label>
            <select
              id={`${moduleKey}-assign-user`}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || saving || options.length === 0}
              className="h-9 min-w-[220px] cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {options.length === 0 ? "No unassigned Entra users" : "Select Entra user…"}
              </option>
              {options.map((row) => (
                <option key={row.user_id} value={row.user_id}>
                  {row.display_name} ({row.email})
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              className="h-9 cursor-pointer"
              disabled={!selectedId || saving}
              onClick={() => void assignSelected()}
            >
              <UserPlus className="size-3.5" />
              {saving ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No users assigned to this module yet.
                  </td>
                </tr>
              ) : (
                members.map((row) => (
                  <tr
                    key={row.user_id}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30"
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
                      <Badge variant={row.role === "admin" ? "secondary" : "outline"} className="font-normal">
                        {row.role === "admin" ? "Module admin" : "User"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{row.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      {row.role === "admin" ? (
                        <span className="text-xs text-muted-foreground">Assigned by ERP admin</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 cursor-pointer"
                          disabled={saving}
                          onClick={() => void removeUser(row.user_id)}
                        >
                          Remove
                        </Button>
                      )}
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
