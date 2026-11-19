"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiClientError,
  createCustomerPrioritySla,
  deleteCustomerPrioritySla,
  formatDurationMinutes,
  listCustomerPrioritySlas,
  loadTicketFormLookups,
  updateCustomerPrioritySla,
  type CustomerPrioritySla,
  type LookupOption,
} from "@/services/service-request-ticket-service";

const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

type Draft = {
  customer_id: string;
  priority: string;
  duration_minutes: string;
  calendar_type: string;
  is_active: string;
};

const emptyDraft = (): Draft => ({
  customer_id: "",
  priority: "p3",
  duration_minutes: "240",
  calendar_type: "calendar",
  is_active: "true",
});

export function CustomerPrioritySlaPanel() {
  const [rows, setRows] = useState<CustomerPrioritySla[]>([]);
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policies, lookups] = await Promise.all([listCustomerPrioritySlas(), loadTicketFormLookups()]);
      setRows(policies);
      setCustomers(lookups.customers);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load customer priority SLAs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const customerName = useMemo(() => {
    const map = new Map(customers.map((c) => [c.value, c.label]));
    return (id: string, fallback?: string | null) => fallback?.trim() || map.get(id) || id.slice(0, 8);
  }, [customers]);

  const startEdit = (row: CustomerPrioritySla) => {
    setEditId(row.id);
    setEditVersion(row.version);
    setDraft({
      customer_id: row.customer_id,
      priority: row.priority,
      duration_minutes: String(row.duration_minutes),
      calendar_type: row.calendar_type ?? "calendar",
      is_active: row.is_active ? "true" : "false",
    });
  };

  const resetDraft = () => {
    setEditId(null);
    setEditVersion(undefined);
    setDraft(emptyDraft());
  };

  const onSave = async () => {
    const minutes = Number(draft.duration_minutes);
    if (!draft.customer_id || !draft.priority || !Number.isFinite(minutes) || minutes <= 0) {
      setError("Customer, priority, and a positive duration (minutes) are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        customer_id: draft.customer_id,
        priority: draft.priority,
        duration_minutes: minutes,
        calendar_type: draft.calendar_type || "calendar",
        is_active: draft.is_active === "true",
      };
      if (editId) {
        await updateCustomerPrioritySla(editId, { ...body, version: editVersion });
      } else {
        await createCustomerPrioritySla(body);
      }
      resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Remove this customer × priority SLA policy?")) return;
    setError(null);
    try {
      await deleteCustomerPrioritySla(id);
      if (editId === id) resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete policy");
    }
  };

  const selectCls =
    "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground";

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Customer × Priority SLAs</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Override resolution targets by customer and ticket priority. Used when tickets are opened.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {!editId ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(emptyDraft())}>
                <Plus className="size-3.5" />
                New policy
              </Button>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={resetDraft}>
                Cancel edit
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Customer</label>
            <select
              className={selectCls}
              value={draft.customer_id}
              onChange={(e) => setDraft((d) => ({ ...d, customer_id: e.target.value }))}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Priority</label>
            <select
              className={selectCls}
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Duration (minutes)
            </label>
            <Input
              type="number"
              min={1}
              value={draft.duration_minutes}
              onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Calendar</label>
            <select
              className={selectCls}
              value={draft.calendar_type}
              onChange={(e) => setDraft((d) => ({ ...d, calendar_type: e.target.value }))}
            >
              <option value="calendar">Calendar (24×7)</option>
              <option value="working">Working hours</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Active</label>
            <select
              className={selectCls}
              value={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.value }))}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <Button type="button" size="sm" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving…" : editId ? "Update policy" : "Add policy"}
        </Button>
      </div>

      <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Calendar</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Loading policies…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No customer × priority policies yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2">{customerName(row.customer_id, row.customer_name)}</td>
                    <td className="px-3 py-2">
                      <FinanceStatusBadge status={row.priority} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{formatDurationMinutes(row.duration_minutes)}</td>
                    <td className="px-3 py-2 capitalize">{row.calendar_type ?? "calendar"}</td>
                    <td className="px-3 py-2">
                      <FinanceStatusBadge status={row.is_active ? "within_sla" : "closed"} label={row.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive"
                          onClick={() => void onDelete(row.id)}
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
      </div>
    </div>
  );
}