"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Info, X } from "lucide-react";

import {
  loadEntityShareSettings,
  saveEntityShareSettings,
  SHARE_PERMISSION_LABELS,
  type CrmShareAccess,
  type CrmShareMember,
  type CrmSharePermission,
  type CrmShareSettings,
} from "@/lib/crm/crm-entity-share-storage";
import { Button } from "@/components/ui/button";
import { listCrmApprovalUsers, type CrmApprovalUser } from "@/services/sales-crm-service";

type Props = {
  open: boolean;
  entityType: string;
  entityId: string;
  entityTitle: string;
  onClose: () => void;
  onShared?: () => void;
};

const DEFAULT_PERMISSION: CrmSharePermission = "full_access";

function defaultSettings(): CrmShareSettings {
  return { accessType: "private", members: [], withRelatedList: false };
}

export function CrmEntityShareDialog({
  open,
  entityType,
  entityId,
  entityTitle,
  onClose,
  onShared,
}: Props) {
  const [accessType, setAccessType] = useState<CrmShareAccess>("private");
  const [members, setMembers] = useState<CrmShareMember[]>([]);
  const [withRelatedList, setWithRelatedList] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [pendingPermission, setPendingPermission] = useState<CrmSharePermission>(DEFAULT_PERMISSION);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [users, setUsers] = useState<CrmApprovalUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const saved = loadEntityShareSettings(entityType, entityId);
    const base = saved ?? defaultSettings();
    setAccessType(base.accessType);
    setMembers(base.members);
    setWithRelatedList(base.withRelatedList);
    setMemberQuery("");
    setPendingPermission(DEFAULT_PERMISSION);
    setPickerOpen(false);
    setError(null);
    let cancelled = false;
    void listCrmApprovalUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const filteredUsers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (memberIds.has(user.id)) return false;
      if (!q) return true;
      const hay = `${user.display_name} ${user.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, memberQuery, memberIds]);

  function addMember(user: CrmApprovalUser) {
    setMembers((prev) => [...prev, { userId: user.id, permission: pendingPermission }]);
    setMemberQuery("");
    setPickerOpen(false);
  }

  function removeMember(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  function updatePermission(userId: string, permission: CrmSharePermission) {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, permission } : m)));
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      saveEntityShareSettings(entityType, entityId, {
        accessType,
        members,
        withRelatedList,
      });
      onShared?.();
      onClose();
    } catch {
      setError("Failed to save share settings");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-share-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="crm-share-title" className="text-base font-semibold text-foreground">
              Share {entityTitle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Control who can access this record in CRM.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            {(["private", "public"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={[
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  accessType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60",
                ].join(" ")}
                onClick={() => setAccessType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={withRelatedList}
              onChange={(e) => setWithRelatedList(e.target.checked)}
              className="cursor-pointer"
            />
            Include related records
            <CircleHelp className="size-3.5 text-muted-foreground" />
          </label>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Members</p>
            <div className="relative">
              <input
                value={memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Search users by name or email"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {pickerOpen && filteredUsers.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
                  {filteredUsers.slice(0, 8).map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer flex-col px-3 py-2 text-left text-xs hover:bg-muted"
                        onClick={() => addMember(user)}
                      >
                        <span className="font-medium text-foreground">{user.display_name}</span>
                        <span className="text-muted-foreground">{user.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <select
              value={pendingPermission}
              onChange={(e) => setPendingPermission(e.target.value as CrmSharePermission)}
              className="h-8 cursor-pointer rounded-lg border border-input bg-background px-2 text-xs"
            >
              {Object.entries(SHARE_PERMISSION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {members.length > 0 ? (
            <ul className="space-y-2 rounded-lg border border-border/70 p-2">
              {members.map((member) => {
                const user = users.find((u) => u.id === member.userId);
                return (
                  <li key={member.userId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                      {user?.display_name ?? member.userId}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={member.permission}
                        onChange={(e) =>
                          updatePermission(member.userId, e.target.value as CrmSharePermission)
                        }
                        className="h-7 cursor-pointer rounded border border-input bg-background px-1.5 text-[11px]"
                      >
                        {Object.entries(SHARE_PERMISSION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="cursor-pointer text-destructive hover:underline"
                        onClick={() => removeMember(member.userId)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> No members added yet.
            </p>
          )}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="cursor-pointer" disabled={busy} onClick={() => void onSave()}>
              {busy ? "Saving…" : "Share"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
