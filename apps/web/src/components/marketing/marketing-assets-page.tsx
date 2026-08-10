"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  createAsset,
  listAssets,
  type MarketingAsset,
} from "@/services/marketing-service";

export function MarketingAssetsPage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAssets({ page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!name.trim() || !fileUrl.trim()) return;
    try {
      await createAsset({ name: name.trim(), file_url: fileUrl.trim() });
      setName("");
      setFileUrl("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create asset");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assets"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {perms.canAssetCreate ? (
              <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="size-3.5" />
                Add asset
              </Button>
            ) : null}
          </div>
        }
      />

      {showForm && perms.canAssetCreate ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/80 p-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hero banner" />
          </div>
          <div className="min-w-[240px] flex-[2]">
            <label className="mb-1 block text-xs text-muted-foreground">File URL</label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" />
          </div>
          <Button type="button" size="sm" onClick={() => void onCreate()}>
            Save
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-mono text-xs">{row.asset_number}</td>
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">
                  <a href={row.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {row.file_url}
                  </a>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.mime_type ?? "—"}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No assets yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
