"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import {
  deleteOnboardingPolicy,
  listOnboardingPolicies,
  saveOnboardingPolicy,
  type OnboardingPolicyDoc,
} from "@/services/onboarding-policies-service";

export function OnboardingPoliciesPanel() {
  const [rows, setRows] = useState<OnboardingPolicyDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingPolicyDoc | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sortOrder, setSortOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const reload = useCallback(() => {
    setRows(listOnboardingPolicies(true));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setBody("");
    setSortOrder(String((rows.length || 0) + 1));
    setStatus("active");
    setOpen(true);
  }

  function openEdit(row: OnboardingPolicyDoc) {
    setEditing(row);
    setTitle(row.title);
    setBody(row.body);
    setSortOrder(String(row.sortOrder));
    setStatus(row.status);
    setOpen(true);
  }

  function save() {
    if (!title.trim()) {
      toast("Title is required", "error");
      return;
    }
    if (!body.trim()) {
      toast("Policy content is required", "error");
      return;
    }
    const id = editing?.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    saveOnboardingPolicy({
      id,
      code: editing?.code ?? `POL-${id.slice(0, 6).toUpperCase()}`,
      title: title.trim(),
      body: body.trim(),
      sortOrder: Number(sortOrder) || 0,
      status,
    });
    toast(editing ? "Policy updated" : "Policy added", "success");
    setOpen(false);
    reload();
  }

  function remove(row: OnboardingPolicyDoc) {
    if (!window.confirm(`Delete “${row.title}”? Candidates will no longer see it.`)) return;
    deleteOnboardingPolicy(row.id);
    toast("Policy deleted", "success");
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Onboarding Policies</h2>
          <p className="text-xs text-muted-foreground">
            Content shown on the candidate portal Policies step (agree + signature).
          </p>
        </div>
        <Button size="sm" className="cursor-pointer" onClick={openCreate}>
          <Plus className="size-3.5" />
          Add policy
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No policies yet. Add handbook, NDA, IT policy, etc.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{row.sortOrder}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.title}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{row.body}</p>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{row.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.updatedAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer px-2"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer px-2 text-destructive"
                        onClick={() => remove(row)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SetupDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit policy" : "Add policy"}
        description="This text is shown when the candidate opens the policy on the onboarding portal."
        footer={
          <>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="cursor-pointer" onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <SetupField label="Title" required>
            <SetupInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </SetupField>
          <SetupField label="Sort order">
            <SetupInput
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </SetupField>
          <SetupField label="Status">
            <SetupSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Policy content" required hint="Shown in the portal policy viewer">
            <SetupTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
          </SetupField>
        </div>
      </SetupDrawer>
    </div>
  );
}
