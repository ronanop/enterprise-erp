"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  createChannel,
  formatMarketingStatus,
  listChannels,
  type MarketingChannel,
} from "@/services/marketing-service";

const PLATFORMS = ["linkedin", "website", "instagram", "facebook", "twitter", "youtube", "email", "other"];

export function MarketingChannelsPage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("linkedin");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listChannels({ page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await createChannel({ name: name.trim(), platform });
      setName("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create channel");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Channels"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {perms.canChannelCreate ? (
              <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="size-3.5" />
                Add channel
              </Button>
            ) : null}
          </div>
        }
      />

      {showForm && perms.canChannelCreate ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/80 p-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company LinkedIn" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {formatMarketingStatus(p)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" onClick={() => void onCreate()}>
            Create
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Handle</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{formatMarketingStatus(row.platform)}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.handle ?? "—"}</td>
                <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No channels configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
