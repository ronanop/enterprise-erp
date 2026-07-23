"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Plus, RefreshCw } from "lucide-react";

import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { createProduct, formatInrPrecise, listProducts, type Product, type ProductFormInput } from "@/services/sales-crm-service";

const PRODUCT_TYPES = ["hardware", "software", "services"];

const EMPTY: ProductFormInput = {
  product_code: "",
  product_name: "",
  product_type: "hardware",
  hsn_sac: "",
  unit_price: 0,
  status: "active",
};

export function ProductsListPage({
  companyAccountId,
  embedded,
}: {
  companyAccountId?: string;
  embedded?: boolean;
} = {}) {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductFormInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listProducts());
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY);
    setFormError(null);
    setDialogOpen(true);
  }

  async function onSave() {
    if (!form.product_name.trim() || !form.product_type) {
      setFormError("Product name and type are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createProduct({ ...form, unit_price: Number(form.unit_price) || 0 });
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save product",
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.product_name.toLowerCase().includes(q) || r.product_code.toLowerCase().includes(q);
  });

  const actions = (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
        <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <Button type="button" size="sm" className="cursor-pointer" onClick={openCreate}>
        <Plus className="size-3.5" /> New Product
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="Products"
          description="Product / SKU catalog used on Quote and OVF lines."
          actions={actions}
        />
      ) : null}

      {companyAccountId ? (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Product catalog is shared across companies.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-sm font-medium tracking-tight">Products</h2>
            <Badge variant="secondary">{filtered.length} shown</Badge>
          </div>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
            {embedded ? actions : null}
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="h-8 w-52 shrink-0 sm:w-56" />
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Product Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">HSN/SAC</th>
                <th className="px-4 py-2.5">Unit Price</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading products…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No products yet. Use “New Product” to add one.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.product_code}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.product_name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize">
                        {row.product_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.hsn_sac ?? "—"}</td>
                    <td className="px-4 py-2.5">{formatInrPrecise(row.unit_price)}</td>
                    <td className="px-4 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="presentation"
          onClick={() => setDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-medium tracking-tight">New Product</h2>

            {formError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <FinanceField label="Product Name *">
                <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
              </FinanceField>
              <div className="grid grid-cols-2 gap-2">
                <FinanceField label="Product Type *">
                  <FinanceSelect value={form.product_type} onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}>
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </FinanceSelect>
                </FinanceField>
                <FinanceField label="Product Code">
                  <Input
                    value={form.product_code ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))}
                    placeholder="Auto-generated if blank"
                  />
                </FinanceField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FinanceField label="HSN / SAC">
                  <Input value={form.hsn_sac ?? ""} onChange={(e) => setForm((f) => ({ ...f, hsn_sac: e.target.value }))} />
                </FinanceField>
                <FinanceField label="Unit Price (₹)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.unit_price ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) || 0 }))}
                  />
                </FinanceField>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" className="cursor-pointer" onClick={() => void onSave()} disabled={saving}>
                {saving ? "Saving…" : "Create Product"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
