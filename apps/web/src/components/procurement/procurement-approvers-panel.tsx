"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, UserCog } from "lucide-react";

import { ApproverMultiSelect } from "@/components/crm/sales/approver-multi-select";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  listProcApprovalStepOwners,
  replaceProcApprovalStepOwners,
  type ProcApprovalStepOwnersGroup,
} from "@/services/procurement-service";
import { listModuleMembers, type ModuleUserRecord } from "@/services/module-users-service";

type OwnerOption = { id: string; label: string; name: string; email: string };

const STEP_ORDER = [
  "accept_po",
  "management_po",
  "invoice_generation",
  "hold_decision",
  "freight_finance",
] as const;

function toOption(id: string, name: string, email: string): OwnerOption {
  const display = (name || email || "User").trim();
  return {
    id: String(id),
    name: display,
    email: email || "",
    label: email ? `${display} (${email})` : display,
  };
}

export function ProcurementApproversPanel() {
  const [groups, setGroups] = useState<ProcApprovalStepOwnersGroup[]>([]);
  const [members, setMembers] = useState<ModuleUserRecord[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ownerGroups, procMembers] = await Promise.all([
        listProcApprovalStepOwners(),
        listModuleMembers("procurement").catch(() => [] as ModuleUserRecord[]),
      ]);
      setGroups(ownerGroups);
      setMembers(procMembers);
      setDraft(
        Object.fromEntries(
          ownerGroups.map((g) => [g.step_key, g.owners.map((o) => String(o.user_id))]),
        ),
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to load approvers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedGroups = useMemo(() => {
    const byKey = new Map(groups.map((g) => [g.step_key, g]));
    const ordered: ProcApprovalStepOwnersGroup[] = [];
    for (const key of STEP_ORDER) {
      const row = byKey.get(key);
      if (row) ordered.push(row);
    }
    for (const row of groups) {
      if (!STEP_ORDER.includes(row.step_key as (typeof STEP_ORDER)[number])) {
        ordered.push(row);
      }
    }
    return ordered;
  }, [groups]);

  const pool = useMemo(() => {
    const byId = new Map<string, OwnerOption>();
    for (const member of members) {
      const id = String(member.user_id);
      byId.set(id, toOption(id, member.display_name, member.email));
    }
    for (const group of groups) {
      for (const owner of group.owners) {
        const id = String(owner.user_id);
        if (!byId.has(id)) {
          byId.set(id, toOption(id, owner.display_name, owner.email));
        }
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [members, groups]);

  function setOwners(stepKey: string, userIds: string[]) {
    setDraft((current) => ({ ...current, [stepKey]: userIds.map(String) }));
    setMessage(null);
  }

  async function saveStep(stepKey: string) {
    setSavingKey(stepKey);
    setError(null);
    setMessage(null);
    try {
      await replaceProcApprovalStepOwners(stepKey, draft[stepKey] ?? []);
      setMessage("Approvers saved.");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Failed to save approvers"));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserCog className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Approvers</p>
            <p className="text-[11px] text-muted-foreground">
              Accept PO, Management, Invoice, Hold, and Freight & finance — selected users own each step
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mx-4 mt-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      <div className="erp-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/60 text-xs font-semibold tracking-wide text-foreground uppercase">
              <th className="px-4 py-2.5">Step</th>
              <th className="px-4 py-2.5">Team</th>
              <th className="px-4 py-2.5">Approvers</th>
              <th className="px-4 py-2.5 text-right">Save</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Loading approvers…
                </td>
              </tr>
            ) : (
              orderedGroups.map((group, index) => {
                const selected = draft[group.step_key] ?? [];
                return (
                  <tr
                    key={group.step_key}
                    className="border-b border-border/50 align-top last:border-0 hover:bg-accent/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <p className="font-medium text-foreground">{group.label}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {group.team_role}
                    </td>
                    <td className="min-w-[280px] px-4 py-3">
                      {pool.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Assign procurement users above first
                        </span>
                      ) : (
                        <ApproverMultiSelect
                          options={pool}
                          value={selected}
                          onChange={(ids) => setOwners(group.step_key, ids)}
                          placeholder="Select approver(s)"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={savingKey === group.step_key}
                        onClick={() => void saveStep(group.step_key)}
                      >
                        <Save className="size-3.5" />
                        {savingKey === group.step_key ? "Saving…" : "Save"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
