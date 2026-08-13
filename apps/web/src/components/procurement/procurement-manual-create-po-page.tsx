"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  INDIAN_STATES,
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
  listVendorOptions,
  peekNextCompanyPoNumber,
  resolveVendorOrgScope,
  type VendorOption,
} from "@/services/procurement-service";
import {
  COMPANY_PO_LOCATIONS,
  companyPoLocationByEntityCode,
  defaultShippingIdForLocation,
  formatCompanyBillingAddress,
  formatCompanyShippingAddress,
  shippingOptionsForLocation,
} from "@/utils/company-po-locations";

const TAX_OPTIONS = ["0", "5", "12", "18", "28"] as const;
const CUSTOM_SHIPPING_ID_PREFIX = "custom-po-";

type PoLineDraft = {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unitCost: number;
};

type PoShippingOption = {
  id: string;
  address: string;
};

type CustomShippingDraft = {
  companyName: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
};

function emptyCustomShippingDraft(
  partial?: Partial<CustomShippingDraft>,
): CustomShippingDraft {
  return {
    companyName: partial?.companyName || "",
    street: partial?.street || "",
    city: partial?.city || "",
    state: partial?.state || "",
    pincode: partial?.pincode || "",
  };
}

function formatCustomShippingAddress(draft: CustomShippingDraft): string {
  return [
    draft.companyName.trim(),
    draft.street.trim(),
    [draft.city.trim(), draft.state.trim()].filter(Boolean).join(", "),
    draft.pincode.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function newCustomShippingId(): string {
  return `${CUSTOM_SHIPPING_ID_PREFIX}${Date.now().toString(36)}`;
}

function newLine(): PoLineDraft {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productName: "",
    description: "",
    quantity: 1,
    unitCost: 0,
  };
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ProcurementManualCreatePoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [poLines, setPoLines] = useState<PoLineDraft[]>(() => [newLine()]);

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
  const shippingMenuRef = useRef<HTMLDivElement>(null);
  const [poShippingExtras, setPoShippingExtras] = useState<PoShippingOption[]>([]);
  const [customShippingOpen, setCustomShippingOpen] = useState(false);
  const [customShippingError, setCustomShippingError] = useState<string | null>(null);
  const [customShippingDraft, setCustomShippingDraft] = useState<CustomShippingDraft>(
    () => emptyCustomShippingDraft(),
  );
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
      const [vendorRows, scope] = await Promise.all([
        listVendorOptions(),
        resolveVendorOrgScope().catch(() => null),
      ]);
      setVendors(vendorRows);
      setOrgScope(scope);
    } catch (err) {
      setError(formatApiError(err, "Failed to load vendors"));
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
  const shippingSelectOptions = useMemo(() => {
    const presets = shippingOptionsForLocation(companyLocation);
    const extras = poShippingExtras.filter(
      (extra) => !presets.some((preset) => preset.address === extra.address),
    );
    return [...presets, ...extras];
  }, [companyLocation, poShippingExtras]);
  const showShippingDropdown =
    !companyLocation.lockShippingToEntity || poShippingExtras.length > 0;

  useEffect(() => {
    const location = companyPoLocationByEntityCode(entityCode);
    const shipId = defaultShippingIdForLocation(location);
    setBillingAddress(formatCompanyBillingAddress(location));
    setShippingAddressId(shipId);
    setShippingAddress(formatCompanyShippingAddress(location.addressHeader, shipId));
    setShippingMenuOpen(false);
  }, [entityCode]);

  useEffect(() => {
    if (!shippingMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && !shippingMenuRef.current?.contains(target)) {
        setShippingMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [shippingMenuOpen]);

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

  function onShippingAddressChange(shippingId: string) {
    const custom = poShippingExtras.find((row) => row.id === shippingId);
    if (custom) {
      setShippingAddressId(custom.id);
      setShippingAddress(custom.address);
      setShippingMenuOpen(false);
      return;
    }
    setShippingAddressId(shippingId);
    setShippingAddress(
      formatCompanyShippingAddress(companyLocation.addressHeader, shippingId),
    );
    setShippingMenuOpen(false);
  }

  function openCustomShippingDialog() {
    setCustomShippingError(null);
    setCustomShippingDraft(
      emptyCustomShippingDraft({
        companyName: companyLocation.addressHeader,
      }),
    );
    setShippingMenuOpen(false);
    setCustomShippingOpen(true);
  }

  function applyCustomShipping() {
    const companyName = customShippingDraft.companyName.trim();
    const street = customShippingDraft.street.trim();
    const city = customShippingDraft.city.trim();
    const state = customShippingDraft.state.trim();
    const pincode = customShippingDraft.pincode.trim();
    if (!companyName || !street || !city || !state || !pincode) {
      setCustomShippingError("Company name, street, city, state, and pincode are required.");
      return;
    }
    const address = formatCustomShippingAddress({
      companyName,
      street,
      city,
      state,
      pincode,
    });
    const existing = poShippingExtras.find((row) => row.address === address);
    const option = existing || { id: newCustomShippingId(), address };
    if (!existing) {
      setPoShippingExtras((current) => [...current, option]);
    }
    setShippingAddressId(option.id);
    setShippingAddress(option.address);
    setCustomShippingOpen(false);
    setCustomShippingError(null);
  }

  const itemsSubtotal = useMemo(
    () =>
      poLines.reduce((sum, line) => {
        if (!(line.productName || "").trim()) return sum;
        return sum + Math.max(0, line.quantity) * Math.max(0, line.unitCost);
      }, 0),
    [poLines],
  );

  const freight = toNumber(freightAmount);
  const finance = toNumber(financeAmount);
  const taxPct = toNumber(taxPercentage);
  const taxableBase = freightTaxable ? itemsSubtotal + freight : itemsSubtotal;
  const gstAmount = (taxableBase * taxPct) / 100;
  const grandTotal = itemsSubtotal + freight + finance + gstAmount;

  function updatePoLine(
    id: string,
    patch: Partial<Pick<PoLineDraft, "productName" | "description" | "quantity" | "unitCost">>,
  ) {
    setPoLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function removePoLine(id: string) {
    setPoLines((current) => {
      if (current.length <= 1) return current;
      return current.filter((line) => line.id !== id);
    });
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
    const lines = poLines
      .map((line) => {
        const product = (line.productName || "").trim();
        const description = (line.description || "").trim();
        return {
          product_name: description
            ? `${product} — ${description}`.slice(0, 255)
            : product,
          quantity: Math.max(0, line.quantity),
          unit_cost: Math.max(0, line.unitCost),
        };
      })
      .filter((line) => line.product_name && line.quantity > 0);
    if (lines.length === 0) {
      setError("Add at least one line with a product name and quantity greater than 0.");
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
        backHref="/procurement/orders"
        backLabel="Purchase Orders"
        title="Create purchase order"
        titleClassName="text-2xl font-semibold tracking-tight sm:text-3xl"
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
              disabled={busy || loading}
            >
              {COMPANY_PO_LOCATIONS.map((opt) => (
                <option key={opt.entityCode} value={opt.entityCode}>{opt.label}</option>
              ))}
            </FinanceSelect>
          </FinanceField>

          <FinanceField label="PO number (auto)" error={peekError ?? undefined}>
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
                disabled={busy || loading}
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
                className="shrink-0 cursor-pointer transition-colors duration-200"
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
            <div className="flex items-start gap-2">
              {showShippingDropdown ? (
                <div ref={shippingMenuRef} className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={busy}
                    aria-haspopup="listbox"
                    aria-expanded={shippingMenuOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShippingMenuOpen((open) => !open);
                    }}
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
                                e.stopPropagation();
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
                  className="min-h-[11rem] min-w-0 flex-1 cursor-default resize-none overflow-y-auto bg-muted/30 font-medium text-foreground"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={openCustomShippingDialog}
                aria-label="Add one-time shipping address for this PO"
                title="Add one-time shipping address for this PO"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-medium tracking-tight text-foreground">Line items</h2>
            <p className="text-xs text-muted-foreground">
              No OVF — enter products, quantities, and rates manually.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={busy}
              onClick={() => setPoLines((current) => [...current, newLine()])}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add line
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Rate (INR)</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {poLines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <Input
                      className="h-8"
                      value={line.productName}
                      disabled={busy}
                      placeholder="Product name"
                      onChange={(e) =>
                        updatePoLine(line.id, { productName: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8"
                      value={line.description}
                      disabled={busy}
                      placeholder="Description"
                      onChange={(e) =>
                        updatePoLine(line.id, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      className="ml-auto h-8 w-20 text-right tabular-nums"
                      inputMode="numeric"
                      value={String(line.quantity)}
                      disabled={busy}
                      onChange={(e) => {
                        const n = Math.max(1, Math.floor(toNumber(e.target.value)));
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
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                      disabled={busy || poLines.length <= 1}
                      aria-label="Remove line"
                      onClick={() => removePoLine(line.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
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
          href="/procurement/orders"
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
          disabled={busy || loading || !vendorId}
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
                className="cursor-pointer transition-colors duration-200"
                disabled={vendorDialogBusy}
                onClick={() => setVendorDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={vendorDialogBusy}
                onClick={() => void saveVendorDialog()}
              >
                {vendorDialogBusy ? "Saving…" : "Save vendor"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={customShippingOpen}
        title="One-time shipping address"
        description="Used on this purchase order only. Not saved to company address lists for later POs."
        confirmLabel="Use this address"
        cancelLabel="Cancel"
        contentClassName="max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onConfirm={applyCustomShipping}
        onCancel={() => {
          setCustomShippingOpen(false);
          setCustomShippingError(null);
        }}
      >
        <div className="mt-4 space-y-3">
          {customShippingError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              {customShippingError}
            </p>
          ) : null}
          <FinanceField label="Company name *">
            <Input
              value={customShippingDraft.companyName}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  companyName: e.target.value,
                }))
              }
              className="h-9"
            />
          </FinanceField>
          <FinanceField label="Street *">
            <Input
              value={customShippingDraft.street}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  street: e.target.value,
                }))
              }
              className="h-9"
            />
          </FinanceField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceField label="City *">
              <Input
                value={customShippingDraft.city}
                onChange={(e) =>
                  setCustomShippingDraft((current) => ({
                    ...current,
                    city: e.target.value,
                  }))
                }
                className="h-9"
              />
            </FinanceField>
            <FinanceField label="Pincode *">
              <Input
                value={customShippingDraft.pincode}
                onChange={(e) =>
                  setCustomShippingDraft((current) => ({
                    ...current,
                    pincode: e.target.value,
                  }))
                }
                className="h-9"
              />
            </FinanceField>
          </div>
          <FinanceField label="State *">
            <FinanceSelect
              value={customShippingDraft.state}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  state: e.target.value,
                }))
              }
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        </div>
      </ConfirmDialog>
    </div>
  );
}
