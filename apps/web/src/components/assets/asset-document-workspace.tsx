"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, FileText, Loader2, Plus, RefreshCw, Replace } from "lucide-react";

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
  type DocumentRow,
  documentService,
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

const DOCUMENT_TYPES = [
  "invoice",
  "warranty",
  "insurance",
  "manual",
  "photo",
  "other",
] as const;
const STATUS_OPTIONS = ["", "active", "superseded", "archived"] as const;
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
  if (status === "superseded") return "secondary";
  return "outline";
}

export function AssetDocumentWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState({
    asset_id: "",
    document_type: "invoice",
    document_name: "",
    storage_uri: "",
    content_hash: "",
  });

  const [editDraft, setEditDraft] = useState({
    document_name: "",
    storage_uri: "",
    content_hash: "",
  });

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canEdit = selected?.status === "active";
  const canSupersede = selected?.status === "active";
  const canArchive =
    selected?.status === "active" || selected?.status === "superseded";

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
      const payload = await documentService.search({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        document_type: typeFilter || undefined,
        asset_id: assetFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load documents");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, assetFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setEditDraft({
      document_name: selected.document_name,
      storage_uri: selected.storage_uri ?? "",
      content_hash: selected.content_hash ?? "",
    });
    setEditing(false);
  }, [selected]);

  const handleCreate = async () => {
    if (!draft.asset_id || !draft.document_name.trim()) {
      setError("Asset and document name are required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const created = await documentService.create({
        asset_id: draft.asset_id,
        document_type: draft.document_type,
        document_name: draft.document_name.trim(),
        storage_uri: draft.storage_uri.trim() || undefined,
        content_hash: draft.content_hash.trim() || undefined,
      });
      setShowCreate(false);
      setDraft({
        asset_id: "",
        document_type: "invoice",
        document_name: "",
        storage_uri: "",
        content_hash: "",
      });
      setSelected(created);
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create document");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected || !canEdit) return;
    if (!editDraft.document_name.trim()) {
      setError("Document name is required.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const updated = await documentService.update(selected.id, {
        document_name: editDraft.document_name.trim(),
        storage_uri: editDraft.storage_uri.trim() || null,
        content_hash: editDraft.content_hash.trim() || null,
        version: selected.version,
      });
      setSelected(updated);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update document");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupersede = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const row = await documentService.supersede(selected.id);
      setSelected(row);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to supersede document");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const row = await documentService.archive(selected.id);
      setSelected(row);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to archive document");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset documents"
        description="Register asset document metadata (URI pointers). Binary files are managed by the enterprise Documents platform."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add document
            </Button>
          </div>
        }
      />

      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Asset Documents store metadata only. Binary file management is handled by the
        enterprise Documents platform.
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Document register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Search documents"
                placeholder="Search name, type, or asset"
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
                value={typeFilter || "__all"}
                onValueChange={(value) => {
                  setPage(1);
                  setTypeFilter(value === "__all" ? "" : value);
                }}
              >
                <SelectTrigger className="w-40 cursor-pointer" aria-label="Filter by type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all" className="cursor-pointer">
                    All types
                  </SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="cursor-pointer">
                      {type}
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
                <SelectTrigger className="w-44 cursor-pointer" aria-label="Filter by asset">
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
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {page} · {total} total
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading documents…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No documents found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const asset = assetMap.get(row.asset_id);
                      const active = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-b transition-colors duration-200 hover:bg-muted/40 ${
                            active ? "bg-muted/60" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className="px-3 py-2 font-medium">{row.document_name}</td>
                          <td className="px-3 py-2">{row.document_type}</td>
                          <td className="px-3 py-2">
                            {asset ? asset.asset_code : row.asset_id.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a document to view details.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                  <span className="text-sm text-muted-foreground">v{selected.version}</span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{selected.document_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{selected.document_type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Asset</dt>
                    <dd>
                      {assetMap.get(selected.asset_id)?.asset_code ?? selected.asset_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Storage URI</dt>
                    <dd className="break-all">{selected.storage_uri || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Content hash</dt>
                    <dd className="break-all font-mono text-xs">
                      {selected.content_hash || "—"}
                    </dd>
                  </div>
                </dl>

                {editing && canEdit ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-name">Document name</Label>
                      <Input
                        id="edit-name"
                        value={editDraft.document_name}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, document_name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-uri">Storage URI</Label>
                      <Input
                        id="edit-uri"
                        placeholder="https://… or s3://…"
                        value={editDraft.storage_uri}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, storage_uri: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-hash">Content hash</Label>
                      <Input
                        id="edit-hash"
                        placeholder="hex digest"
                        value={editDraft.content_hash}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, content_hash: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={actionLoading}
                        onClick={() => void handleUpdate()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canEdit && !editing ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => setEditing(true)}
                    >
                      Edit metadata
                    </Button>
                  ) : null}
                  {canSupersede ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void handleSupersede()}
                    >
                      <Replace className="mr-2 h-4 w-4" />
                      Supersede
                    </Button>
                  ) : null}
                  {canArchive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void handleArchive()}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Register document metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide a storage URI pointer only. Do not upload binary files here.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Asset</Label>
                <Select
                  value={draft.asset_id || undefined}
                  onValueChange={(value) => setDraft((d) => ({ ...d, asset_id: value }))}
                >
                  <SelectTrigger className="cursor-pointer" aria-label="Select asset">
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
              <div className="space-y-1">
                <Label>Document type</Label>
                <Select
                  value={draft.document_type}
                  onValueChange={(value) => setDraft((d) => ({ ...d, document_type: value }))}
                >
                  <SelectTrigger className="cursor-pointer" aria-label="Document type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="doc-name">Document name</Label>
                <Input
                  id="doc-name"
                  value={draft.document_name}
                  onChange={(e) => setDraft((d) => ({ ...d, document_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="doc-uri">Storage URI (optional)</Label>
                <Input
                  id="doc-uri"
                  placeholder="https://… or s3://…"
                  value={draft.storage_uri}
                  onChange={(e) => setDraft((d) => ({ ...d, storage_uri: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="doc-hash">Content hash (optional)</Label>
                <Input
                  id="doc-hash"
                  placeholder="hex digest"
                  value={draft.content_hash}
                  onChange={(e) => setDraft((d) => ({ ...d, content_hash: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                disabled={actionLoading}
                onClick={() => void handleCreate()}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
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
    </div>
  );
}
