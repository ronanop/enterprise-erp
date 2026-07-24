"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus, RefreshCw } from "lucide-react";

import { CrmErrorBanner, CrmInfoBanner, CrmListPanel, CrmPage } from "@/components/crm/crm-ui";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { CrmListToolbar } from "@/components/crm/sales/crm-list-toolbar";
import { CrmSortableTh, sortRows, useTableSort } from "@/components/crm/sales/crm-table-sort";
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

type SortKey = "product_code" | "product_name" | "product_type" | "hsn_sac" | "unit_price" | "status";

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
  const { sortBy, sortDir, onSort } = useTableSort<SortKey>("product_name");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductFormInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");

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
    const missing: string[] = [];
    if (!form.product_name.trim()) missing.push("Product Name");
    if (!form.product_type) missing.push("Product Type");
    if (missing.length > 0) {
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.product_name.toLowerCase().includes(q) || r.product_code.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortBy, sortDir, {
        product_code: (r) => r.product_code,
        product_name: (r) => r.product_name,
        product_type: (r) => r.product_type,
        hsn_sac: (r) => r.hsn_sac,
        unit_price: (r) => r.unit_price,
        status: (r) => r.status,
      }),
    [filtered, sortBy, sortDir],
  );

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
    <CrmPage>
      {!embedded ? (
        <PageHeader
          title="Products"
          description="Product / SKU catalog used on Quote and OVF lines."
          actions={actions}
        />
      ) : null}

      {companyAccountId ? (
        <CrmInfoBanner>Product catalog is shared across companies.</CrmInfoBanner>
      ) : null}

      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}

      <CrmListPanel>
        <CrmListToolbar
          title="Products"
          subtitle="Product / SKU catalog"
          icon={Package}
          count={sorted.length}
          actions={embedded ? actions : null}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search products…",
          }}
        />

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <CrmSortableTh label="Product Code" sortKey="product_code" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Name" sortKey="product_name" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Type" sortKey="product_type" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="HSN/SAC" sortKey="hsn_sac" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Unit Price" sortKey="unit_price" activeKey={sortBy} dir={sortDir} onSort={onSort} />
                <CrmSortableTh label="Status" sortKey="status" activeKey={sortBy} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading products…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No products yet. Use “New Product” to add one.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
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
      </CrmListPanel>

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

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        onClose={() => setMandateOpen(false)}
      />
    </CrmPage>
  );
}
