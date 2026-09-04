"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, RefreshCw } from "lucide-react";

import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  validateVendorFormDraft,
  VendorFormFields,
  type VendorFormDraft,
} from "@/components/procurement/vendor-form-fields";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  createPoFromInventory,
  createVendorOption,
  listProcurementInventory,
  listVendorOptions,
  peekNextCompanyPoNumber,
  resolveVendorOrgScope,
  type ProcurementInventoryRow,
  type VendorOption,
} from "@/services/procurement-service";
import { isGrnNonBilledStockRow, buildProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";
import {
  COMPANY_PO_LOCATIONS,
  companyPoLocationByEntityCode,
  defaultShippingIdForLocation,
  formatCompanyBillingAddress,
  formatCompanyShippingAddress,
  shippingOptionsForLocation,
} from "@/utils/company-po-locations";

const TAX_OPTIONS = ["0", "5", "12", "18", "28"] as const;

type PoLineDraft = {
  id: string;
  productName: string;
  quantity: number;
  unitCost: number;
};

function stockRowKey(row: ProcurementInventoryRow, index: number): string {
  return `${row.grn_number}-${row.company_po_number}-${row.line_number}-${row.unit_index}-${index}`;
}

function productLabel(row: ProcurementInventoryRow): string {
  return (row.product_name || "").trim() || "Unnamed product";
}

function poGrnLabel(value: string | null | undefined): string {
  const text = (value || "").trim();
  return text || "—";
}

function keysForPoGrnGroup(
  rows: ProcurementInventoryRow[],
  group: { productName: string; companyPoNumber: string; grnNumber: string },
): string[] {
  const keys: string[] = [];
  rows.forEach((row, index) => {
    if (productLabel(row) !== group.productName) return;
    if (poGrnLabel(row.company_po_number) !== group.companyPoNumber) return;
    if (poGrnLabel(row.grn_number) !== group.grnNumber) return;
    keys.push(stockRowKey(row, index));
  });
  return keys;
}

function groupSelectionState(
  keys: string[],
  selectedKeys: Set<string>,
): "none" | "partial" | "all" {
  if (keys.length === 0) return "none";
  let count = 0;
  for (const key of keys) {
    if (selectedKeys.has(key)) count += 1;
  }
  if (count === 0) return "none";
  if (count === keys.length) return "all";
  return "partial";
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ProcurementInventoryCreatePoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockRows, setStockRows] = useState<ProcurementInventoryRow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [poLines, setPoLines] = useState<PoLineDraft[]>([]);

  const [vendorId, setVendorId] = useState("");
  const [entityCode, setEntityCode] = useState("CDT");
  const initialCompanyLocation = companyPoLocationByEntityCode("CDT");
  const [billingAddress, setBillingAddress] = useState(() =>
    formatCompanyBillingAddress(initialCompanyLocation),
  );
  const [shippingAddressId, setShippingAddressId] = useState(() =>
    defaultShippingIdForLocation(initialCompanyLocation),
  );
  const [shippingAddress, setShippingAddress] = useState(() =>
    formatCompanyShippingAddress(
      initialCompanyLocation.addressHeader,
      defaultShippingIdForLocation(initialCompanyLocation),
    ),
  );
  const [shippingMenuOpen, setShippingMenuOpen] = useState(false);
  const [documentDate, setDocumentDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [paymentTerms, setPaymentTerms] = useState("Net 30 days");
  const [approvedByName, setApprovedByName] = useState("");
  const [nextPo, setNextPo] = useState("");
  const [peekBusy, setPeekBusy] = useState(false);
  const [peekError, setPeekError] = useState<string | null>(null);

  const [freightAmount, setFreightAmount] = useState("0");
  const [financeAmount, setFinanceAmount] = useState("0");
  const [taxPercentage, setTaxPercentage] = useState("18");
  const [freightTaxable, setFreightTaxable] = useState(false);

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDialogBusy, setVendorDialogBusy] = useState(false);
  const [vendorDialogError, setVendorDialogError] = useState<string | null>(null);
  const [vendorDraft, setVendorDraft] = useState<VendorFormDraft>(() => emptyVendorFormDraft());
  const [orgScope, setOrgScope] = useState<{ company_id: string; branch_id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventory, vendorRows, scope] = await Promise.all([
        listProcurementInventory(),
        listVendorOptions(),
        resolveVendorOrgScope().catch(() => null),
      ]);
      setStockRows(inventory.filter(isGrnNonBilledStockRow));
      setVendors(vendorRows);
      setOrgScope(scope);
    } catch (err) {
      setError(formatApiError(err, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companyLocation = useMemo(
    () => companyPoLocationByEntityCode(entityCode),
    [entityCode],
  );
  const showShippingDropdown = !companyLocation.lockShippingToEntity;
  const shippingSelectOptions = useMemo(
    () => shippingOptionsForLocation(companyLocation),
    [companyLocation],
  );

  useEffect(() => {
    const location = companyPoLocationByEntityCode(entityCode);
    const shipId = defaultShippingIdForLocation(location);
    setBillingAddress(formatCompanyBillingAddress(location));
    setShippingAddressId(shipId);
    setShippingAddress(formatCompanyShippingAddress(location.addressHeader, shipId));
    setShippingMenuOpen(false);
  }, [entityCode]);

  useEffect(() => {
    let cancelled = false;
    setPeekBusy(true);
    setPeekError(null);
    void peekNextCompanyPoNumber(entityCode)
      .then((row) => {
        if (!cancelled) setNextPo((row.company_po_number || "").trim());
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setNextPo("");
          setPeekError(
            err instanceof Error && err.message.trim()
              ? err.message
              : "Could not load the next PO number.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPeekBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityCode]);

  const allSelected =
    stockRows.length > 0 &&
    stockRows.every((row, index) => selectedKeys.has(stockRowKey(row, index)));

  const stockSummary = useMemo(
    () => buildProcurementInventoryStockSummary(stockRows),
    [stockRows],
  );

  useEffect(() => {
    const byProduct = new Map<string, { quantity: number; unitCost: number }>();
    stockRows.forEach((row, index) => {
      const key = stockRowKey(row, index);
      if (!selectedKeys.has(key)) return;
      const name = (row.product_name || "").trim() || "Unnamed product";
      const entry = byProduct.get(name) ?? { quantity: 0, unitCost: 0 };
      entry.quantity += 1;
      const cost = Number(row.unit_cost) || 0;
      if (cost > 0) entry.unitCost = cost;
      byProduct.set(name, entry);
    });
    setPoLines(
      Array.from(byProduct.entries()).map(([productName, data], idx) => ({
        id: `line-${idx}-${productName}`,
        productName,
        quantity: data.quantity,
        unitCost: data.unitCost,
      })),
    );
  }, [selectedKeys, stockRows]);

  function onShippingAddressChange(shippingId: string) {
    setShippingAddressId(shippingId);
    setShippingAddress(
      formatCompanyShippingAddress(companyLocation.addressHeader, shippingId),
    );
    setShippingMenuOpen(false);
  }

  function togglePoGrnGroup(group: {
    productName: string;
    companyPoNumber: string;
    grnNumber: string;
  }) {
    const keys = keysForPoGrnGroup(stockRows, group);
    const state = groupSelectionState(keys, selectedKeys);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (state === "all") {
        for (const key of keys) next.delete(key);
      } else {
        for (const key of keys) next.add(key);
      }
      return next;
    });
  }

  function toggleAllStock() {
    if (allSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(stockRows.map((row, index) => stockRowKey(row, index))));
  }

  const itemsSubtotal = useMemo(
    () => poLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    [poLines],
  );

  const freight = toNumber(freightAmount);
  const finance = toNumber(financeAmount);
  const taxPct = toNumber(taxPercentage);
  const taxableBase = freightTaxable ? itemsSubtotal + freight : itemsSubtotal;
  const gstAmount = (taxableBase * taxPct) / 100;
  const grandTotal = itemsSubtotal + freight + finance + gstAmount;

  function updatePoLine(id: string, patch: Partial<Pick<PoLineDraft, "quantity" | "unitCost">>) {
    setPoLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function openVendorDialog() {
    setVendorDraft(emptyVendorFormDraft());
    setVendorDialogError(null);
    setVendorDialogOpen(true);
  }

  async function saveVendorDialog() {
    const validationError = validateVendorFormDraft(vendorDraft);
    if (validationError) {
      setVendorDialogError(validationError);
      return;
    }
    if (!orgScope?.company_id || !orgScope?.branch_id) {
      setVendorDialogError("Missing company/branch scope. Open Vendors or SCM first.");
      return;
    }
    setVendorDialogBusy(true);
    setVendorDialogError(null);
    try {
      const created = await createVendorOption({
        vendor_name: vendorDraft.vendorName.trim(),
        company_id: orgScope.company_id,
        branch_id: orgScope.branch_id,
        addressEntries: buildVendorAddressEntriesFromForm(vendorDraft),
        email: vendorDraft.email,
        mobile: vendorDraft.mobile,
        contactFirstName: vendorDraft.contactFirstName,
        contactLastName: vendorDraft.contactLastName,
      });
      setVendors((current) =>
        [...current.filter((v) => v.id !== created.id), created].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      );
      setVendorId(created.id);
      setVendorDialogOpen(false);
    } catch (err) {
      setVendorDialogError(
        err instanceof ApiClientError ? err.message : "Failed to create vendor",
      );
    } finally {
      setVendorDialogBusy(false);
    }
  }

  async function onCreatePo() {
    if (!vendorId) {
      setError("Select a vendor.");
      return;
    }
    if (poLines.length === 0) {
      setError("Select at least one stock unit to add PO lines.");
      return;
    }

    const selectedRows = stockRows.filter((row, index) =>
      selectedKeys.has(stockRowKey(row, index)),
    );
    const unitsByProduct = new Map<string, ProcurementInventoryRow[]>();
    for (const row of selectedRows) {
      const name = (row.product_name || "").trim() || "Unnamed product";
      const list = unitsByProduct.get(name) ?? [];
      list.push(row);
      unitsByProduct.set(name, list);
    }

    const stockUnitIds: string[] = [];
    const importLineIds: string[] = [];
    const lines: Array<{ product_name: string; quantity: number; unit_cost: number }> = [];

    for (const line of poLines) {
      const available = unitsByProduct.get(line.productName) ?? [];
      const qty = Math.min(Math.max(1, Math.floor(line.quantity)), available.length || line.quantity);
      const consume = available.slice(0, Math.min(qty, available.length));
      for (const row of consume) {
        if (row.stock_unit_id) stockUnitIds.push(row.stock_unit_id);
        else if (row.import_line_id) importLineIds.push(row.import_line_id);
      }
      lines.push({
        product_name: line.productName,
        quantity: consume.length > 0 ? consume.length : qty,
        unit_cost: line.unitCost,
      });
    }

    if (stockUnitIds.length === 0 && importLineIds.length === 0) {
      setError("Selected stock units are missing inventory IDs. Refresh stock and try again.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const order = await createPoFromInventory({
        vendor_id: vendorId,
        entity_code: entityCode,
        document_date: documentDate,
        payment_terms: paymentTerms,
        approved_by_name: approvedByName,
        lines,
        stock_unit_ids: stockUnitIds,
        import_line_ids: importLineIds,
      });
      router.push(`/procurement/orders/${order.id}`);
    } catch (err) {
      setError(formatApiError(err, "Failed to create purchase order"));
      setBusy(false);
    }
  }

  return (
    <div className={cn(procurementUi.page, "max-w-[1400px]")}>
      <PageHeader
        backHref="/procurement/inventory"
        backLabel="Inventory"
        title="Create purchase order from stock"
        titleClassName="text-2xl font-semibold tracking-tight sm:text-3xl"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Refresh stock
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vendor &amp; references
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FinanceField label="Entity">
            <FinanceSelect
              value={entityCode}
              onChange={(e) => setEntityCode(e.target.value)}
              disabled={busy}
            >
              {COMPANY_PO_LOCATIONS.map((opt) => (
                <option key={opt.entityCode} value={opt.entityCode}>{opt.label}</option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField
            label="PO number"
            error={peekError ?? undefined}
          >
            <Input
              readOnly
              className="h-8 font-mono text-sm font-medium tabular-nums"
              value={peekBusy ? "Loading…" : nextPo || "—"}
            />
          </FinanceField>

          <FinanceField label="Purchase date">
            <Input
              type="date"
              className="h-8"
              value={documentDate}
              disabled={busy}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </FinanceField>

          <FinanceField label="Vendor">
            <div className="flex gap-2">
              <FinanceSelect
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={busy}
                className="min-w-0 flex-1"
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </FinanceSelect>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 cursor-pointer"
                disabled={busy}
                onClick={openVendorDialog}
              >
                <Plus className="mr-1 size-3.5" />
                Add vendor
              </Button>
            </div>
          </FinanceField>

          <FinanceField label="Payment terms">
            <Input
              className="h-8"
              value={paymentTerms}
              disabled={busy}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </FinanceField>

          <FinanceField label="Approved by">
            <Input
              className="h-8"
              value={approvedByName}
              disabled={busy}
              placeholder="Name of approver"
              onChange={(e) => setApprovedByName(e.target.value)}
            />
          </FinanceField>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Our company &amp; addresses
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
          <FinanceField label="Billing address">
            <FinanceTextarea
              value={billingAddress}
              readOnly
              rows={8}
              className="min-h-[11rem] cursor-default resize-none overflow-y-auto bg-muted/30 font-medium text-foreground"
            />
          </FinanceField>
          <div className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Shipping address
            </span>
            {showShippingDropdown ? (
              <div className="relative min-w-0">
                <button
                  type="button"
                  disabled={busy}
                  aria-haspopup="listbox"
                  aria-expanded={shippingMenuOpen}
                  onClick={() => setShippingMenuOpen((open) => !open)}
                  className={cn(
                    "flex min-h-[11rem] w-full cursor-pointer items-start gap-2 rounded-lg border border-input bg-muted/30 px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors duration-200",
                    "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    busy && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="min-w-0 flex-1 whitespace-pre-wrap">{shippingAddress}</span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      shippingMenuOpen && "rotate-180",
                    )}
                  />
                </button>
                {shippingMenuOpen && !busy ? (
                  <ul
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
                  >
                    {shippingSelectOptions.map((option) => {
                      const selected = shippingAddressId === option.id;
                      return (
                        <li key={option.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onShippingAddressChange(option.id);
                            }}
                            className={cn(
                              "w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-sm font-medium whitespace-pre-wrap transition-colors duration-150",
                              selected
                                ? "bg-primary/10 text-foreground"
                                : "text-foreground hover:bg-muted/60",
                            )}
                          >
                            {option.address}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : (
              <FinanceTextarea
                value={shippingAddress}
                readOnly
                rows={8}
                className="min-h-[11rem] cursor-default resize-none overflow-y-auto bg-muted/30 font-medium text-foreground"
              />
            )}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-medium tracking-tight text-foreground">PO line items</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Tax %
            <FinanceSelect
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(e.target.value)}
              disabled={busy}
              className="h-8 w-[88px]"
            >
              {TAX_OPTIONS.map((pct) => (
                <option key={pct} value={pct}>{pct}%</option>
              ))}
            </FinanceSelect>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Rate (INR)</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {poLines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Select stock units above to build PO lines.
                  </td>
                </tr>
              ) : (
                poLines.map((line) => (
                  <tr key={line.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{line.productName}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        className="ml-auto h-8 w-20 text-right tabular-nums"
                        inputMode="numeric"
                        value={String(line.quantity)}
                        disabled={busy}
                        onChange={(e) => {
                          const selectedForProduct = stockRows.filter((row, index) => {
                            if (!selectedKeys.has(stockRowKey(row, index))) return false;
                            const name = (row.product_name || "").trim() || "Unnamed product";
                            return name === line.productName;
                          }).length;
                          const maxQty = Math.max(1, selectedForProduct);
                          const n = Math.min(maxQty, Math.max(1, Math.floor(toNumber(e.target.value))));
                          updatePoLine(line.id, { quantity: n });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        className="ml-auto h-8 w-28 text-right tabular-nums"
                        inputMode="decimal"
                        value={String(line.unitCost)}
                        disabled={busy}
                        onChange={(e) =>
                          updatePoLine(line.id, { unitCost: toNumber(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {(line.quantity * line.unitCost).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Freight &amp; finance
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceField label="Freight (INR)">
              <Input
                className="h-8 tabular-nums"
                inputMode="decimal"
                value={freightAmount}
                disabled={busy}
                onChange={(e) => setFreightAmount(e.target.value)}
              />
            </FinanceField>
            <FinanceField label="Finance cost (INR)">
              <Input
                className="h-8 tabular-nums"
                inputMode="decimal"
                value={financeAmount}
                disabled={busy}
                onChange={(e) => setFinanceAmount(e.target.value)}
              />
            </FinanceField>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={freightTaxable}
              disabled={busy}
              onChange={(e) => setFreightTaxable(e.target.checked)}
            />
            Apply GST on freight (items + freight taxable base)
          </label>
        </div>
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-4 text-sm">
          <div className="flex justify-between tabular-nums">
            <span className="text-muted-foreground">Items subtotal</span>
            <span>{itemsSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-muted-foreground">Freight</span>
            <span>{freight.toFixed(2)}</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-muted-foreground">Finance</span>
            <span>{finance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-muted-foreground">GST ({taxPct}%)</span>
            <span>{gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2 text-base font-semibold tabular-nums">
            <span>Estimated total</span>
            <span>{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href="/procurement/inventory"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "cursor-pointer transition-colors duration-200",
          )}
        >
          Cancel
        </Link>
        <Button
          type="button"
          className="cursor-pointer transition-colors duration-200"
          disabled={busy || loading || !vendorId || poLines.length === 0}
          onClick={() => void onCreatePo()}
        >
          {busy ? "Creating PO…" : "Create purchase order"}
        </Button>
      </div>

      {vendorDialogOpen ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-foreground/40 p-4"
          role="presentation"
          onClick={() => {
            if (!vendorDialogBusy) setVendorDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium">Add vendor</h3>
            {vendorDialogError ? (
              <p className="mt-2 text-sm text-destructive">{vendorDialogError}</p>
            ) : null}
            <div className="mt-4">
              <VendorFormFields
                value={vendorDraft}
                onChange={setVendorDraft}
                disabled={vendorDialogBusy}
                showVendorType={false}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={vendorDialogBusy}
                onClick={() => setVendorDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={vendorDialogBusy}
                onClick={() => void saveVendorDialog()}
              >
                {vendorDialogBusy ? "Saving…" : "Save vendor"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
