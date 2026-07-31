"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, QrCode, RefreshCw, UserPlus, Wrench } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  brandModelLabel,
  mapAssetToPrdStatus,
  prdStatusLabel,
  type PrdAssetStatus,
} from "@/domain/asset-prd";
import { isAuthenticated } from "@/lib/auth";
import {
  assetCategoryService,
  assetRegisterService,
  filterActiveCategories,
  type AssetCategoryRow,
  type AssetsRow,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

const PRD_STATUS_FILTERS: { value: "" | PrdAssetStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "reserved", label: "Reserved" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "lost", label: "Lost" },
  { value: "disposed", label: "Disposed" },
];

export function AssetListWorkspace() {
  const [rows, setRows] = useState<AssetsRow[]>([]);
  const [assignments, setAssignments] = useState<AssetsRow[]>([]);
  const [categories, setCategories] = useState<AssetCategoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [prdStatusFilter, setPrdStatusFilter] = useState<"" | PrdAssetStatus>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoryById = useMemo(() => {
    const m = new Map<string, AssetCategoryRow>();
    for (const c of categories) m.set(String(c.id), c);
    return m;
  }, [categories]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const [assetRes, asnRes] = await Promise.all([
        assetRegisterService.search({ page, page_size: 25, q: search.trim() || undefined }),
        resourceService.list("/assets/asset-assignments?page=1&page_size=200"),
      ]);
      const asnPayload = asnRes.data as { items?: AssetsRow[] };
      const asnRows = Array.isArray(asnPayload?.items) ? asnPayload.items : [];
      setAssignments(asnRows);
      setRows(assetRes.items);
      setTotal(assetRes.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load assets");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void (async () => {
      if (!isAuthenticated()) return;
      try {
        const payload = await assetCategoryService.search({
          page: 1,
          page_size: 200,
          status: "active",
        });
        setCategories(filterActiveCategories(payload.items));
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (categoryFilter && String(row.asset_category_id) !== categoryFilter) {
        return false;
      }
      if (prdStatusFilter) {
        const prd = mapAssetToPrdStatus(row, assignments);
        if (prd !== prdStatusFilter) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, prdStatusFilter, assignments]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Assets"
        description="Search, filter, and open asset details."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} className="cursor-pointer">
              <RefreshCw className="mr-1 size-4" />
              Refresh
            </Button>
            <Button size="sm" asChild className="cursor-pointer">
              <Link href="/assets/assets/new">
                <Plus className="mr-1 size-4" />
                Add Asset
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="asset-search">Search</Label>
            <Input
              id="asset-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or code"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="mt-1 cursor-pointer">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={prdStatusFilter}
              onValueChange={(v) => setPrdStatusFilter(v as "" | PrdAssetStatus)}
            >
              <SelectTrigger className="mt-1 cursor-pointer">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {PRD_STATUS_FILTERS.map((o) => (
                  <SelectItem key={o.label} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full cursor-pointer"
              onClick={() => {
                setPage(1);
                void load();
              }}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {selectedIds.size > 0 ? (
        <p className="text-xs text-muted-foreground">
          {selectedIds.size} selected — bulk actions coming soon.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">Asset</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Brand / model</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No assets found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const id = String(row.id);
                const cat = categoryById.get(String(row.asset_category_id ?? ""));
                const prd = mapAssetToPrdStatus(row, assignments);
                return (
                  <tr key={id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleRow(id)}
                        aria-label={`Select ${row.asset_name}`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link
                        href={`/assets/assets/${id}`}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {String(row.asset_name ?? "—")}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{String(row.asset_code ?? "—")}</td>
                    <td className="px-3 py-2">{cat?.category_name ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{String(row.asset_type ?? "—")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{brandModelLabel(row)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{prdStatusLabel(prd)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="cursor-pointer">
                          <Link href={`/assets/asset-assignments?assetId=${id}`} title="Assign">
                            <UserPlus className="size-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="cursor-pointer">
                          <Link href={`/assets/asset-maintenances?assetId=${id}`} title="Maintenance">
                            <Wrench className="size-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="cursor-pointer">
                          <Link href={`/assets/qr-barcode?assetId=${id}`} title="QR">
                            <QrCode className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredRows.length} of {total} assets (page {page}).
      </p>
    </div>
  );
}
