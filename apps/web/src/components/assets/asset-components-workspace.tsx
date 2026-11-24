"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import {
  StatusBadge,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  type ComponentRow,
  type ComponentTreeResult,
  COMPONENT_TYPE_OPTIONS,
  componentService,
  componentTypeLabel,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatDropdownLabel } from "@/components/assets/shared/format-dropdown-label";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  status?: string | null;
  operational_status?: string | null;
};

function isInstallableParentAsset(row: AssetRow): boolean {
  const lifecycle = String(row.status ?? "").trim().toLowerCase();
  const ops = String(row.operational_status ?? "").trim().toUpperCase();
  if (lifecycle === "disposed" || lifecycle === "retired") return false;
  if (ops === "DISPOSED" || ops === "RETIRED" || ops === "PENDING_DISPOSAL") return false;
  return lifecycle === "active" || lifecycle === "";
}

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const PAGE_SIZE = 25;

function parseListPayload<T>(data: unknown): ListPayload<T> {
  if (data && typeof data === "object" && "items" in data) {
    const payload = data as ListPayload<T>;
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      page_size: payload.page_size ?? PAGE_SIZE,
    };
  }
  return { items: [], total: 0, page: 1, page_size: PAGE_SIZE };
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function displayIdentity(row: ComponentRow): { primary: string; secondary: string } {
  if (row.linked_asset_code || row.linked_asset_name) {
    return {
      primary: [row.linked_asset_code, row.linked_asset_name].filter(Boolean).join(" · "),
      secondary: componentTypeLabel(row.component_type),
    };
  }
  return {
    primary: componentTypeLabel(row.component_type),
    secondary: row.component_name || row.component_code,
  };
}

export function AssetComponentsWorkspace() {
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [draftAssetId, setDraftAssetId] = useState("");
  const [draftType, setDraftType] = useState("OTHER");
  const [draftSerial, setDraftSerial] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ComponentRow | null>(null);
  const [tree, setTree] = useState<ComponentTreeResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSerial, setEditSerial] = useState("");

  const assetLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      map.set(a.id, `${a.asset_code} · ${a.asset_name}`);
    }
    return map;
  }, [assets]);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    const res = await resourceService.list<ListPayload<AssetRow>>(
      "/assets/assets?page=1&page_size=200&sort=asset_code&status=active",
    );
    const parsed = parseListPayload<AssetRow>(res.data);
    setAssets(parsed.items.filter(isInstallableParentAsset));
  }, []);

  const loadRows = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await componentService.search({
        page,
        page_size: PAGE_SIZE,
        q: q.trim() || undefined,
        sort: "created_at",
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(errMessage(err, "Failed to load components"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function openDetail(row: ComponentRow) {
    setSelected(row);
    setDetailOpen(true);
    setEditMode(false);
    setEditName(row.component_name);
    setEditSerial(row.serial_number ?? "");
    try {
      setTree(await componentService.tree(row.asset_id));
    } catch {
      setTree(null);
    }
  }

  async function handleInstall() {
    if (!draftAssetId) {
      setError("Select a parent asset");
      return;
    }
    if (draftType === "CHARGER" && !draftSerial.trim()) {
      setError("Serial number is required for chargers");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await componentService.install({
        asset_id: draftAssetId,
        component_type: draftType,
        serial_number: draftSerial.trim() || undefined,
      });
      setInstallOpen(false);
      setDraftSerial("");
      await loadRows();
      await openDetail(created);
    } catch (err) {
      setError(errMessage(err, "Install failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await componentService.update(selected.id, {
        component_name: editName.trim() || selected.component_name,
        serial_number: editSerial.trim() || null,
        version: selected.version,
      });
      setSelected(updated);
      setEditMode(false);
      await loadRows();
    } catch (err) {
      setError(errMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDispose() {
    if (!selected) return;
    if (
      !window.confirm(
        selected.component_asset_id
          ? "Dispose this component and cascade-dispose the linked asset (ops only, no finance workflow)?"
          : "Dispose this component?",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await componentService.dispose(selected.id);
      setSelected(updated);
      await loadRows();
    } catch (err) {
      setError(errMessage(err, "Dispose failed"));
    } finally {
      setSaving(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AssetsPremiumPage testId="asset-components-workspace">
      <PageHeader
        title="Asset Components"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer gap-2 transition-colors duration-200"
              onClick={() => void loadRows()}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              type="button"
              className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
              onClick={() => {
                setInstallOpen(true);
                setError(null);
              }}
            >
              <Plus className="size-4" />
              Install Component
            </Button>
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <Card className={ASSETS_SURFACE_CARD}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-3 space-y-0 pb-3">
          <Input
            className="h-9 w-full max-w-xs"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Search code, name, serial…"
            aria-label="Search components"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Parent asset</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No components found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <td className={tableSerialCellClassName()}>{tableRowSerial(page, PAGE_SIZE, index)}</td>
                      <td className="px-4 py-2.5">{componentTypeLabel(row.component_type)}</td>
                      <td className="px-4 py-2.5">
                        {assetLabelById.get(row.asset_id) ?? row.asset_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{formatDropdownLabel(row.status)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer gap-1.5 transition-colors duration-200"
                          onClick={() => void openDetail(row)}
                        >
                          <Eye className="size-3.5" />
                          View Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              {total} total · page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {installOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/40"
            aria-label="Close install dialog"
            onClick={() => setInstallOpen(false)}
          />
          <div
            role="dialog"
            aria-modal
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Install component</h2>
                <p className="text-sm text-muted-foreground">
                  Code and name are generated automatically.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setInstallOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Parent asset</Label>
                <Select value={draftAssetId || undefined} onValueChange={setDraftAssetId}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select parent asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.asset_code} · {a.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Component type</Label>
                <Select value={draftType} onValueChange={setDraftType}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Serial number{draftType === "CHARGER" ? " *" : ""}</Label>
                <Input
                  value={draftSerial}
                  onChange={(e) => setDraftSerial(e.target.value)}
                  placeholder="Optional unless charger"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setInstallOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
                disabled={saving}
                onClick={() => void handleInstall()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Install"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="component-detail-drawer">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/40"
            aria-label="Close detail drawer"
            onClick={() => setDetailOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Component detail</h2>
                <p className="text-xs text-muted-foreground">{displayIdentity(selected).primary}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setDetailOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <section className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{formatDropdownLabel(selected.status)}</Badge>
                  {selected.component_asset_id ? (
                    <Badge variant="outline">Asset-linked</Badge>
                  ) : null}
                </div>
                <p>
                  <span className="text-muted-foreground">Type: </span>
                  {componentTypeLabel(selected.component_type)}
                </p>
                <p>
                  <span className="text-muted-foreground">Code: </span>
                  {selected.component_code}
                </p>
                <p>
                  <span className="text-muted-foreground">Name: </span>
                  {selected.component_name}
                </p>
                {selected.linked_asset_code ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Linked asset: </span>
                      {selected.linked_asset_code} · {selected.linked_asset_name}
                    </p>
                    {selected.linked_asset_operational_status ? (
                      <StatusBadge
                        kind="operational"
                        status={selected.linked_asset_operational_status}
                      />
                    ) : null}
                  </>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Parent: </span>
                  {assetLabelById.get(selected.asset_id) ?? selected.asset_id}
                </p>
                <p>
                  <span className="text-muted-foreground">S/N: </span>
                  {selected.serial_number?.trim() || "—"}
                </p>
                {selected.status === "active" && !selected.component_asset_id ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setEditMode((v) => !v)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="cursor-pointer gap-1"
                      onClick={() => void handleDispose()}
                    >
                      <Trash2 className="size-3.5" />
                      Dispose
                    </Button>
                  </div>
                ) : null}
                {selected.status === "active" && selected.component_asset_id ? (
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="cursor-pointer gap-1"
                      onClick={() => void handleDispose()}
                    >
                      <Trash2 className="size-3.5" />
                      Dispose (cascade)
                    </Button>
                  </div>
                ) : null}
                {editMode ? (
                  <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                    <Label>Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <Label>Serial</Label>
                    <Input value={editSerial} onChange={(e) => setEditSerial(e.target.value)} />
                    <Button
                      type="button"
                      size="sm"
                      className={cn("cursor-pointer", ASSETS_ACCENT_BTN)}
                      disabled={saving}
                      onClick={() => void handleUpdate()}
                    >
                      Save
                    </Button>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Boxes className="size-3.5" /> Hierarchy
                </h3>
                {tree ? (
                  <ul className="m-0 space-y-1 list-none p-0 text-sm">
                    <li className="font-medium">
                      {tree.asset.asset_code} · {tree.asset.asset_name}
                    </li>
                    {tree.components.map((c) => (
                      <li key={String(c.id)} className="pl-3 text-muted-foreground">
                        · {c.linked_asset_code || c.component_code} (
                        {formatDropdownLabel(String(c.status ?? ""))})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No hierarchy loaded.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </AssetsPremiumPage>
  );
}
