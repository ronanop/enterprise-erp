"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Replace,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  type ComponentHistoryResult,
  type ComponentRow,
  type ComponentTreeResult,
  componentService,
} from "@/services/assets-service";
import { ApiClientError, resourceService } from "@/services/api-client";

type AssetRow = {
  id: string;
  asset_code: string;
  asset_name: string;
};

type ListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

const STATUS_OPTIONS = ["", "active", "replaced", "disposed"] as const;
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

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "replaced") return "secondary";
  return "outline";
}

export function AssetComponentsWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<ComponentRow | null>(null);
  const [tree, setTree] = useState<ComponentTreeResult | null>(null);
  const [history, setHistory] = useState<ComponentHistoryResult | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const [draft, setDraft] = useState({
    asset_id: "",
    component_code: "",
    component_name: "",
    serial_number: "",
    quantity: "1",
  });

  const [replaceDraft, setReplaceDraft] = useState({
    component_name: "",
    serial_number: "",
    quantity: "",
  });

  const [editDraft, setEditDraft] = useState({
    component_name: "",
    serial_number: "",
    quantity: "",
  });
  const [editing, setEditing] = useState(false);

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = selected?.status === "active";
  const canReplace = selected?.status === "active";
  const canDispose = selected?.status === "active";

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const res = await resourceService.list<ListPayload<AssetRow>>(
        `${assetsPath}?page=1&page_size=200&status=active`,
      );
      setAssetOptions(parseListPayload<AssetRow>(res.data).items);
    } catch {
      setAssetOptions([]);
    }
  }, [assetsPath]);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await componentService.search({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        asset_id: assetFilter || undefined,
        q: search.trim() || undefined,
        sort: "component_code",
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load components");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, assetFilter, search]);

  const loadTree = useCallback(async (assetId: string) => {
    try {
      const payload = await componentService.tree(assetId);
      setTree(payload);
    } catch {
      setTree(null);
    }
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const payload = await componentService.history(id);
      setHistory(payload);
    } catch {
      setHistory(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) {
      setHistory(null);
      return;
    }
    setEditDraft({
      component_name: selected.component_name,
      serial_number: selected.serial_number ?? "",
      quantity: selected.quantity != null ? String(selected.quantity) : "",
    });
    setReplaceDraft({
      component_name: selected.component_name,
      serial_number: "",
      quantity: selected.quantity != null ? String(selected.quantity) : "1",
    });
    setEditing(false);
    setShowReplace(false);
    void loadHistory(selected.id);
    void loadTree(selected.asset_id);
  }, [selected, loadHistory, loadTree]);

  useEffect(() => {
    if (assetFilter) {
      void loadTree(assetFilter);
    } else if (!selected) {
      setTree(null);
    }
  }, [assetFilter, selected, loadTree]);

  const handleInstall = async () => {
    if (!draft.asset_id || !draft.component_code.trim() || !draft.component_name.trim()) {
      setError("Asset, component code, and name are required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const created = await componentService.install({
        asset_id: draft.asset_id,
        component_code: draft.component_code.trim(),
        component_name: draft.component_name.trim(),
        serial_number: draft.serial_number.trim() || undefined,
        quantity: draft.quantity.trim() || undefined,
      });
      setShowCreate(false);
      setDraft({
        asset_id: "",
        component_code: "",
        component_name: "",
        serial_number: "",
        quantity: "1",
      });
      setSelected(created);
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to install component");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected || !canEdit) return;
    if (!editDraft.component_name.trim()) {
      setError("Component name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const updated = await componentService.update(selected.id, {
        component_name: editDraft.component_name.trim(),
        serial_number: editDraft.serial_number.trim() || null,
        quantity: editDraft.quantity.trim() || null,
        version: selected.version,
      });
      setSelected(updated);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update component");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplace = async () => {
    if (!selected || !canReplace) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await componentService.replace(selected.id, {
        component_name: replaceDraft.component_name.trim() || undefined,
        serial_number: replaceDraft.serial_number.trim() || undefined,
        quantity: replaceDraft.quantity.trim() || undefined,
      });
      setShowReplace(false);
      setSelected(result.successor);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to replace component");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispose = async () => {
    if (!selected || !canDispose) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await componentService.dispose(selected.id);
      setSelected(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to dispose component");
    } finally {
      setActionLoading(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Asset Components"
        description="Lightweight child parts under a parent asset (depth 1). Not inventory or warehouse stock."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Install Component
            </Button>
          </div>
        }
      />

      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Components belong to exactly one parent asset. Replace preserves history under the same
        component code; dispose is terminal.
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Install component</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cmp-asset">Parent asset</Label>
              <Select
                value={draft.asset_id || undefined}
                onValueChange={(value) => setDraft((d) => ({ ...d, asset_id: value }))}
              >
                <SelectTrigger id="cmp-asset" className="cursor-pointer">
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetOptions.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                      {asset.asset_code} — {asset.asset_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmp-code">Component code</Label>
              <Input
                id="cmp-code"
                value={draft.component_code}
                onChange={(e) => setDraft((d) => ({ ...d, component_code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmp-name">Component name</Label>
              <Input
                id="cmp-name"
                value={draft.component_name}
                onChange={(e) => setDraft((d) => ({ ...d, component_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmp-serial">Serial number</Label>
              <Input
                id="cmp-serial"
                value={draft.serial_number}
                onChange={(e) => setDraft((d) => ({ ...d, serial_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmp-qty">Quantity</Label>
              <Input
                id="cmp-qty"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void handleInstall()}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Install
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Boxes className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Component register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search components"
                placeholder="Search code, name, or serial"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="max-w-xs"
              />
              <Select
                value={statusFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setStatusFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-36 cursor-pointer" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem
                      key={status || "__all"}
                      value={status || "__all"}
                      className="cursor-pointer"
                    >
                      {status || "All statuses"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assetFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setAssetFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-52 cursor-pointer" aria-label="Filter by asset">
                  <SelectValue placeholder="Asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All assets
                  </SelectItem>
                  {assetOptions.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="cursor-pointer">
                      {asset.asset_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No components found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const asset = assetMap.get(row.asset_id);
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-t border-border transition-colors duration-200 hover:bg-muted/40 ${
                            selected?.id === row.id ? "bg-muted/60" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className="px-3 py-2 font-medium">{row.component_code}</td>
                          <td className="px-3 py-2">{row.component_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {asset?.asset_code ?? row.asset_id.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                          </td>
                          <td className="px-3 py-2">{row.quantity ?? "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pageCount} · {total} total
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!selected ? (
                <p className="text-muted-foreground">Select a component to view details.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{selected.component_code}</span>
                    <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                  </div>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                          id="edit-name"
                          value={editDraft.component_name}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, component_name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-serial">Serial</Label>
                        <Input
                          id="edit-serial"
                          value={editDraft.serial_number}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, serial_number: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-qty">Quantity</Label>
                        <Input
                          id="edit-qty"
                          value={editDraft.quantity}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, quantity: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={actionLoading}
                          onClick={() => void handleUpdate()}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          onClick={() => setEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <dl className="grid gap-2">
                      <div>
                        <dt className="text-muted-foreground">Name</dt>
                        <dd>{selected.component_name}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Serial</dt>
                        <dd>{selected.serial_number || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Quantity</dt>
                        <dd>{selected.quantity ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Version</dt>
                        <dd>{selected.version}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {canEdit && !editing ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {canReplace ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        onClick={() => setShowReplace((v) => !v)}
                      >
                        <Replace className="mr-1 h-4 w-4" />
                        Replace
                      </Button>
                    ) : null}
                    {canDispose ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void handleDispose()}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Dispose
                      </Button>
                    ) : null}
                  </div>

                  {showReplace ? (
                    <div className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-muted-foreground">
                        Marks this component replaced and installs a new active successor (same
                        code by default).
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="rep-name">Successor name</Label>
                        <Input
                          id="rep-name"
                          value={replaceDraft.component_name}
                          onChange={(e) =>
                            setReplaceDraft((d) => ({ ...d, component_name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rep-serial">New serial (optional)</Label>
                        <Input
                          id="rep-serial"
                          value={replaceDraft.serial_number}
                          onChange={(e) =>
                            setReplaceDraft((d) => ({ ...d, serial_number: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void handleReplace()}
                      >
                        Confirm replace
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Hierarchy (depth 1)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!tree ? (
                <p className="text-muted-foreground">
                  Select a component or filter by asset to view the tree.
                </p>
              ) : (
                <>
                  <p className="font-medium">
                    {tree.asset.asset_code} — {tree.asset.asset_name}
                  </p>
                  <ul className="space-y-1 border-l border-border pl-3">
                    {tree.components.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="cursor-pointer text-left transition-colors duration-200 hover:text-foreground"
                          onClick={() => {
                            void componentService.get(c.id).then(setSelected).catch(() => {
                              setError("Failed to load component detail");
                            });
                          }}
                        >
                          {c.component_code} · {c.component_name}{" "}
                          <Badge variant={statusVariant(c.status)} className="ml-1">
                            {c.status}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Code history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!history || history.lineage.length === 0 ? (
                <p className="text-muted-foreground">No history for the selected component.</p>
              ) : (
                <ol className="space-y-2 border-l border-border pl-3">
                  {history.lineage.map((entry) => (
                    <li key={entry.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                        <span>{entry.component_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.created_at ?? "—"}
                        {entry.serial_number ? ` · SN ${entry.serial_number}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
