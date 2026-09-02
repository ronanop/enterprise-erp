"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  validateVendorFormDraft,
  vendorFormFromOption,
  VendorFormFields,
  type VendorFormDraft,
} from "@/components/procurement/vendor-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  createVendorOption,
  formatInr,
  invalidateProcurementListCache,
  listPurchaseOrders,
  listVendorOptions,
  peekPurchaseOrdersFromCache,
  peekVendorOptionsFromCache,
  resolveVendorOrgScope,
  updateVendorOption,
  type ProcOrder,
  type VendorOption,
} from "@/services/procurement-service";

type VendorPoSummary = {
  count: number;
  totalAmount: number;
  orders: ProcOrder[];
};

function groupOrdersByVendor(orders: ProcOrder[]): Record<string, VendorPoSummary> {
  const map: Record<string, VendorPoSummary> = {};
  for (const order of orders) {
    const key = order.vendor_id;
    if (!map[key]) {
      map[key] = { count: 0, totalAmount: 0, orders: [] };
    }
    map[key].count += 1;
    map[key].totalAmount += Number(order.total_amount) || 0;
    map[key].orders.push(order);
  }
  for (const summary of Object.values(map)) {
    summary.orders.sort((a, b) => String(b.document_date).localeCompare(String(a.document_date)));
  }
  return map;
}

export function VendorsListPage() {
  const cachedVendorsOnMount = peekVendorOptionsFromCache();
  const [rows, setRows] = useState<VendorOption[]>(() =>
    cachedVendorsOnMount
      ? [...cachedVendorsOnMount].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        )
      : [],
  );
  const [orders, setOrders] = useState<ProcOrder[]>(() => peekPurchaseOrdersFromCache() ?? []);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => cachedVendorsOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgScope, setOrgScope] = useState<{ company_id: string; branch_id: string } | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editing, setEditing] = useState<VendorOption | null>(null);
  const [draft, setDraft] = useState<VendorFormDraft>(emptyVendorFormDraft());

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekVendorOptionsFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const [vendors, scope, purchaseOrders] = await Promise.all([
        listVendorOptions(),
        resolveVendorOrgScope().catch(() => null),
        listPurchaseOrders().catch(() => [] as ProcOrder[]),
      ]);
      setRows(
        [...vendors].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        ),
      );
      setOrgScope(scope);
      setOrders(purchaseOrders);
    } catch (err) {
      if (!hadInstant) {
        setRows([]);
        setOrders([]);
      }
      setError(formatApiError(err, "Failed to load vendors"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const poByVendor = useMemo(() => groupOrdersByVendor(orders), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const contact = [row.contactFirstName, row.contactLastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        row.label.toLowerCase().includes(q) ||
        contact.includes(q) ||
        (row.email || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  function contactDisplayName(row: VendorOption): string {
    const name = [row.contactFirstName, row.contactLastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    return name || "—";
  }

  function openAddDialog() {
    setEditing(null);
    setDialogError(null);
    setDraft(emptyVendorFormDraft());
    setDialogOpen(true);
  }

  function openEditDialog(row: VendorOption) {
    setEditing(row);
    setDialogError(null);
    setDraft(vendorFormFromOption(row));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogBusy(false);
    setDialogError(null);
    setEditing(null);
  }

  function upsertRow(next: VendorOption) {
    setRows((current) =>
      [...current.filter((row) => row.id !== next.id), next].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    );
  }

  function toggleExpanded(vendorId: string) {
    setExpandedVendorId((current) => (current === vendorId ? null : vendorId));
  }

  async function saveVendor() {
    const validationError = validateVendorFormDraft(draft);
    if (validationError) {
      setDialogError(validationError);
      return;
    }
    const name = draft.vendorName.trim();
    const addressEntries = buildVendorAddressEntriesFromForm(draft);

    setDialogBusy(true);
    setDialogError(null);
    try {
      if (editing) {
        if (editing.version == null) {
          setDialogError("Missing vendor version — refresh and try again.");
          return;
        }
        const updated = await updateVendorOption({
          vendor_id: editing.id,
          version: editing.version,
          vendor_name: name,
          vendor_type: draft.vendorType,
          tax_number: addressEntries[0]?.gstNumber || null,
          addressEntries,
          email: draft.email,
          mobile: draft.mobile,
          contactFirstName: draft.contactFirstName,
          contactLastName: draft.contactLastName,
        });
        upsertRow({
          ...updated,
          vendorCode: updated.vendorCode || editing.vendorCode,
        });
      } else {
        let scope = orgScope;
        if (!scope) {
          scope = await resolveVendorOrgScope().catch(() => null);
          if (scope) setOrgScope(scope);
        }
        if (!scope?.company_id || !scope?.branch_id) {
          setDialogError("Could not resolve company/branch to create a vendor.");
          return;
        }
        const created = await createVendorOption({
          vendor_name: name,
          company_id: scope.company_id,
          branch_id: scope.branch_id,
          addressEntries,
          vendor_type: draft.vendorType,
          email: draft.email,
          mobile: draft.mobile,
          contactFirstName: draft.contactFirstName,
          contactLastName: draft.contactLastName,
        });
        upsertRow(created);
      }
      closeDialog();
    } catch (err) {
      setDialogError(
        formatApiError(
          err,
          editing ? "Failed to update vendor" : "Failed to create vendor",
        ),
      );
    } finally {
      setDialogBusy(false);
    }
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Vendors"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={openAddDialog}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add vendor
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load(true)}
              disabled={loading && rows.length === 0}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 size-3.5",
                  (loading || refreshing) && "animate-spin",
                )}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {filtered.length} vendors · {orders.length} purchase orders linked
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by vendor or contact…"
            aria-label="Search by vendor or contact"
            className="h-8 max-w-xs shadow-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">S.No</th>
                <th className="px-3 py-2 font-medium">Vendor name</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">POs</th>
                <th className="px-3 py-2 font-medium">PO total</th>
                <th className="px-3 py-2 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Loading vendors…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No vendors yet. Use Add vendor to create one.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row, index) => {
                const summary = poByVendor[row.id];
                const poCount = summary?.count ?? 0;
                const poTotal = summary?.totalAmount ?? 0;
                const expanded = expandedVendorId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-border/70 transition-colors duration-150 hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={poCount === 0}
                          aria-expanded={expanded}
                          aria-label={
                            poCount === 0
                              ? "No purchase orders"
                              : expanded
                                ? "Hide purchase orders"
                                : "Show purchase orders"
                          }
                          onClick={() => toggleExpanded(row.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2">{contactDisplayName(row)}</td>
                      <td className="px-3 py-2 capitalize">{row.vendorType || "—"}</td>
                      <td className="max-w-[280px] px-3 py-2">
                        <div className="truncate" title={row.addresses.join(" | ") || row.address}>
                          {row.addresses.length > 1
                            ? `${row.addresses[0]} (+${row.addresses.length - 1} more)`
                            : row.address || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {poCount > 0 ? (
                          <button
                            type="button"
                            className="cursor-pointer font-medium text-[#0369A1] underline-offset-2 transition-colors duration-150 hover:underline"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            {poCount}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {poCount > 0 ? formatInr(poTotal) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "cursor-pointer gap-1.5 transition-colors duration-200",
                          )}
                          onClick={() => openEditDialog(row)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                    {expanded && summary ? (
                      <tr className="border-b border-border/70 bg-muted/20">
                        <td colSpan={9} className="px-3 py-3">
                          <div className="rounded-md border border-border bg-card">
                            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Purchase orders with {row.label}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[880px] text-left text-sm">
                                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">Company PO #</th>
                                    <th className="px-3 py-2 font-medium">Date</th>
                                    <th className="px-3 py-2 font-medium">Customer</th>
                                    <th className="px-3 py-2 font-medium">Amount</th>
                                    <th className="px-3 py-2 font-medium">PO status</th>
                                    <th className="px-3 py-2 font-medium">Lines</th>
                                    <th className="px-3 py-2 font-medium">Open</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {summary.orders.map((po) => (
                                    <tr key={po.id} className="border-b border-border/60 last:border-0">
                                      <td className="px-3 py-2 font-medium tabular-nums">
                                        {po.company_po_number || po.document_number}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">{po.document_date || "—"}</td>
                                      <td className="px-3 py-2">{po.customer_name || "—"}</td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {formatInr(po.total_amount)}
                                      </td>
                                      <td className="px-3 py-2">
                                        <FinanceStatusBadge status={po.status} />
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {(po.lines || []).length}
                                      </td>
                                      <td className="px-3 py-2">
                                        <Link
                                          href={`/procurement/orders/${po.id}`}
                                          className={cn(
                                            buttonVariants({ size: "sm", variant: "outline" }),
                                            "cursor-pointer transition-colors duration-200",
                                          )}
                                        >
                                          Open
                                        </Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title={editing ? "Edit vendor" : "Add vendor"}
        description={
          editing
            ? "Update contact, addresses, GST, and supply details."
            : "Enter contact and vendor details. Add one or more addresses (billing, shipping, GST, and supply per location)."
        }
        confirmLabel={editing ? "Save changes" : "Save vendor"}
        busy={dialogBusy}
        contentClassName="max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onConfirm={() => void saveVendor()}
        onCancel={closeDialog}
      >
        <div className="mt-4 space-y-4">
          {dialogError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              {dialogError}
            </p>
          ) : null}
          <VendorFormFields
            value={draft}
            onChange={setDraft}
            disabled={dialogBusy}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
