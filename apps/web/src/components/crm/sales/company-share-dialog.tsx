"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Info, X } from "lucide-react";

import {
  loadCompanyShareSettings,
  saveCompanyShareSettings,
  SHARE_PERMISSION_LABELS,
  type CompanyShareAccess,
  type CompanyShareMember,
  type CompanySharePermission,
  type CompanyShareSettings,
} from "@/lib/crm/company-share-storage";
import { Button } from "@/components/ui/button";
import { listCrmApprovalUsers, type Company, type CrmApprovalUser } from "@/services/sales-crm-service";

type CompanyShareDialogProps = {
  open: boolean;
  company: Company;
  onClose: () => void;
  onShared?: () => void;
};

const DEFAULT_PERMISSION: CompanySharePermission = "full_access";

function defaultSettings(): CompanyShareSettings {
  return { accessType: "private", members: [], withRelatedList: false };
}

export function CompanyShareDialog({ open, company, onClose, onShared }: CompanyShareDialogProps) {
  const [accessType, setAccessType] = useState<CompanyShareAccess>("private");
  const [members, setMembers] = useState<CompanyShareMember[]>([]);
  const [withRelatedList, setWithRelatedList] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [pendingPermission, setPendingPermission] = useState<CompanySharePermission>(DEFAULT_PERMISSION);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [users, setUsers] = useState<CrmApprovalUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const saved = loadCompanyShareSettings(company.id);
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
  }, [open, company.id]);

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
    setMembers((prev) => [
      ...prev,
      {
        userId: user.id,
        displayName: user.display_name,
        permission: pendingPermission,
      },
    ]);
    setMemberQuery("");
    setPickerOpen(false);
  }

  function removeMember(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  function onShare() {
    setBusy(true);
    setError(null);
    try {
      const payload: CompanyShareSettings = {
        accessType,
        members,
        withRelatedList,
      };
      saveCompanyShareSettings(company.id, payload);
      onShared?.();
      onClose();
    } catch {
      setError("Could not save sharing settings.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-share-title"
        className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="company-share-title" className="text-base font-extrabold tracking-tight text-foreground">
            Sharing Account
          </h2>
          <button
            type="button"
            className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Sharing help"
            title="Share this company account with CRM team members and set their access level."
          >
            <CircleHelp className="size-4" />
          </button>
        </div>

        <fieldset className="mt-5 space-y-2">
          <legend className="text-sm font-medium text-foreground">Record access type</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="company-share-access"
                className="size-4 cursor-pointer accent-primary"
                checked={accessType === "private"}
                onChange={() => setAccessType("private")}
              />
              Private
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="company-share-access"
                className="size-4 cursor-pointer accent-primary"
                checked={accessType === "public"}
                onChange={() => setAccessType("public")}
              />
              Public
            </label>
          </div>
        </fieldset>

        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Add members"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
              {pickerOpen && filteredUsers.length > 0 ? (
                <ul
                  className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-card py-1 text-sm shadow-lg"
                  role="listbox"
                >
                  {filteredUsers.slice(0, 12).map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        role="option"
                        className="flex w-full cursor-pointer flex-col px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => addMember(user)}
                      >
                        <span className="font-medium text-foreground">{user.display_name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <select
              value={pendingPermission}
              onChange={(e) => setPendingPermission(e.target.value as CompanySharePermission)}
              className="h-9 min-w-[9.5rem] cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Permission for new members"
            >
              {(Object.keys(SHARE_PERMISSION_LABELS) as CompanySharePermission[]).map((key) => (
                <option key={key} value={key}>
                  {SHARE_PERMISSION_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {members.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {member.displayName}{" "}
                    <span className="text-muted-foreground">({SHARE_PERMISSION_LABELS[member.permission]})</span>
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${member.displayName}`}
                    onClick={() => removeMember(member.userId)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4 cursor-pointer rounded border-input accent-primary"
            checked={withRelatedList}
            onChange={(e) => setWithRelatedList(e.target.checked)}
          />
          With Related list
          <span
            className="inline-flex text-muted-foreground"
            title="Include related leads, meetings, and follow-ups when sharing."
          >
            <Info className="size-3.5" aria-hidden />
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex justify-end">
          <Button type="button" className="cursor-pointer" disabled={busy} onClick={() => void onShare()}>
            {busy ? "Sharing…" : "Share"}
          </Button>
        </div>
      </div>
    </div>
  );
}
