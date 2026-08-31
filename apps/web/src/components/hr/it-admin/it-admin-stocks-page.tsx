"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  updatedAt: string;
};

const KEY = "erp_it_admin_stocks_v1";

function load(): StockItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StockItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(rows: StockItem[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function ItAdminStocksPage() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");

  useEffect(() => {
    setRows(load());
  }, []);

  function addItem() {
    if (!name.trim()) {
      toast("Item name is required", "error");
      return;
    }
    const next: StockItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      quantity: Math.max(0, Number(quantity) || 0),
      unit: unit.trim() || "pcs",
      updatedAt: new Date().toISOString(),
    };
    const list = [next, ...rows];
    save(list);
    setRows(list);
    setName("");
    setSku("");
    setQuantity("1");
    toast("Stock item added");
  }

  function adjust(id: string, delta: number) {
    const list = rows.map((r) =>
      r.id === id
        ? {
            ...r,
            quantity: Math.max(0, r.quantity + delta),
            updatedAt: new Date().toISOString(),
          }
        : r,
    );
    save(list);
    setRows(list);
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Stocks Manage"
        description="Track IT & Admin inventory (stationery, assets staging, consumables)."
      />

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Add stock item</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="h-9"
          />
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU (optional)"
            className="h-9"
          />
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            className="h-9"
          />
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit"
            className="h-9"
          />
          <Button type="button" className="h-9 cursor-pointer gap-1" onClick={addItem}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 size-6 opacity-50" />
          No stock items yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.sku} · updated {r.updatedAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => adjust(r.id, -1)}
                >
                  −
                </Button>
                <span
                  className={cn(
                    "min-w-[4rem] text-center text-sm font-semibold",
                    r.quantity === 0 && "text-destructive",
                  )}
                >
                  {r.quantity} {r.unit}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => adjust(r.id, 1)}
                >
                  +
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
