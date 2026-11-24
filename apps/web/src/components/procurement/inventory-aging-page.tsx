"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Boxes, RefreshCw, ShieldAlert, TriangleAlert, Unlock } from "lucide-react";

import { CrmErrorBanner, CrmListPanel, CrmPage, CrmSection, CRM_TABLE_HEAD_ROW } from "@/components/crm/crm-ui";
import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ApiClientError } from "@/services/api-client";
import {
  assignInventoryOwner,
  decideInventoryTransfer,
  inventorySelection,
  listInventoryTransfers,
  listInventoryUnits,
  requestInventoryTransfer,
  setInventoryOpenForSale,
  type InventoryTransfer,
  type InventoryUnit,
} from "@/services/crm-deal-controls-service";
import { formatInr, listCrmMemberOptions, type Option } from "@/services/sales-crm-service";

const SELECT_CLASS =
  "h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-[13px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const BUCKET_CLASS: Record<string, string> = {
  "0-30": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  "31-90": "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  "91-180": "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  "181-365": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  "365+": "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100",
};

/**
 * Organisation-wide stock: who owns it, how old it is, what it costs to keep,
 * and warranty left. Owners release stock for sale; others request it.
 */
export function InventoryAgingPage() {
  const { user } = useAuthUser();
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [members, setMembers] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [assignOwner, setAssignOwner] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitRows, transferRows, memberRows] = await Promise.all([
        listInventoryUnits(),
        listInventoryTransfers().catch(() => []),
        listCrmMemberOptions().catch(() => [] as Option[]),
      ]);
      setUnits(unitRows);
      setTransfers(transferRows);
      setMembers(memberRows);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter(
      (u) =>
        (!bucket || u.aging_bucket === bucket) &&
        (!ownerFilter || (ownerFilter === "open" ? u.status === "open_for_sale" : u.owner_employee_id === ownerFilter)) &&
        (!q || `${u.product_name ?? ""} ${u.serial_number ?? ""} ${u.owner_name ?? ""}`.toLowerCase().includes(q)),
    );
  }, [units, query, bucket, ownerFilter]);

  const selectedUnits = units.filter((u) => selected.has(u.id));
  const myEmployeeId = user?.employeeId ?? members.find((m) => m.userId && m.userId === user?.id)?.id;

  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      await load();
      setNotice(message);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingForMe = transfers.filter((t) => t.status === "pending" && t.owner_employee_id && t.owner_employee_id === myEmployeeId);
  const pendingOther = transfers.filter((t) => t.status === "pending" && !pendingForMe.includes(t));

  return (
    <CrmPage>
      <PageHeader
        title="Inventory Aging & Ownership"
        actions={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      />
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}
      {notice ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p> : null}

      {pendingForMe.length > 0 || pendingOther.length > 0 ? (
        <CrmSection title="Stock Requests" icon={ArrowLeftRight}>
          <ul className="space-y-2 text-[13px]">
            {[...pendingForMe, ...pendingOther].map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                <span>
                  {Number(t.quantity)} x {t.product_name}
                  {t.customer_note ? <span className="text-muted-foreground"> - {t.customer_note}</span> : null}
                  <span className="block text-[11px] text-muted-foreground">
                    Requested by {members.find((m) => m.id === t.requester_employee_id)?.label ?? "a colleague"} ·
                    owner {members.find((m) => m.id === t.owner_employee_id)?.label ?? "-"}
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    className="h-7 cursor-pointer text-xs"
                    onClick={() => void run(() => decideInventoryTransfer(t.id, true), "Stock handed over.")}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="h-7 cursor-pointer text-xs"
                    onClick={() => void run(() => decideInventoryTransfer(t.id, false), "Request rejected.")}
                  >
                    Reject
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CrmSection>
      ) : null}

      <CrmListPanel>
        <div className="flex flex-wrap items-end gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Boxes className="size-4 text-muted-foreground" />
            <h2 className="text-base font-extrabold tracking-tight">Stock on hand</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} units</span>
          </div>
          <Input
            aria-label="Search stock"
            placeholder="Search product, serial, owner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-64 text-[13px]"
          />
          <select aria-label="Filter by owner" className={`${SELECT_CLASS} w-52`} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">All owners</option>
            <option value="open">Open for sale</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {bucket || ownerFilter || query ? (
            <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={() => { setBucket(""); setOwnerFilter(""); setQuery(""); }}>
              Clear filters
            </Button>
          ) : null}
        </div>

        {selectedUnits.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-accent/20 px-4 py-2 text-xs">
            <span className="font-semibold">{selectedUnits.length} selected</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-7 cursor-pointer text-xs"
              onClick={() => void run(() => setInventoryOpenForSale(inventorySelection(selectedUnits), true), "Released - anyone can now sell this stock.")}
            >
              <Unlock className="size-3.5" /> Open for sale
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-7 cursor-pointer text-xs"
              onClick={() => { setRequestNote(""); setRequestOpen(true); }}
            >
              <ArrowLeftRight className="size-3.5" /> Request from owner
            </Button>
            <select
              aria-label="Assign owner"
              className={`${SELECT_CLASS} h-7 w-48 text-xs`}
              value={assignOwner}
              onChange={(e) => setAssignOwner(e.target.value)}
            >
              <option value="">Assign owner (SCM)…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !assignOwner}
              className="h-7 cursor-pointer text-xs"
              onClick={() => void run(() => assignInventoryOwner(inventorySelection(selectedUnits), assignOwner), "Owner updated.")}
            >
              Assign
            </Button>
          </div>
        ) : null}

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    className="size-4 cursor-pointer accent-primary"
                    checked={filtered.length > 0 && filtered.every((u) => selected.has(u.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((u) => u.id)) : new Set())}
                  />
                </th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Serial</th>
                <th className="px-3 py-2.5">Age</th>
                <th className="px-3 py-2.5 text-right">Cost</th>
                <th className="px-3 py-2.5">Warranty</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading stock…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No stock matches these filters.</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.product_name ?? "unit"} ${u.serial_number ?? ""}`}
                        className="size-4 cursor-pointer accent-primary"
                        checked={selected.has(u.id)}
                        onChange={() => toggle(u.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{u.product_name ?? "-"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.serial_number ?? "-"}</td>
                    <td className="px-3 py-2">
                      <Badge className={`rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${BUCKET_CLASS[u.aging_bucket] ?? ""}`}>
                        {u.age_days} d
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatInr(u.unit_cost)}</td>
                    <td className="px-3 py-2 text-xs">
                      {u.warranty_valid_till ? (
                        <span className={u.warranty_expired ? "inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400" : ""}>
                          {u.warranty_expired ? <ShieldAlert className="size-3.5" /> : null}
                          {u.warranty_expired ? "Expired " : ""}
                          {u.warranty_valid_till}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not recorded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>

      <ConfirmDialog
        open={requestOpen}
        title="Request stock from its owner"
        description={`${selectedUnits.length} unit(s). The owner gets a notification and can hand them over.`}
        confirmLabel="Send request"
        busy={busy}
        onCancel={() => !busy && setRequestOpen(false)}
        onConfirm={() =>
          void run(async () => {
            await requestInventoryTransfer(inventorySelection(selectedUnits), requestNote.trim() || undefined);
            setRequestOpen(false);
          }, "Request sent to the owner.")
        }
      >
        <FinanceField label="Customer / order you need it for" className="space-y-2">
          <FinanceTextarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Hero MotoCorp - 5 x i5 laptops, PO expected this week"
            className="min-h-[72px] text-[13px]"
          />
        </FinanceField>
        {error ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="size-3.5" /> {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </CrmPage>
  );
}
