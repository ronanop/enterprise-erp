"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";

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
  type NotificationRow,
  notificationService,
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

const NOTIFICATION_TYPES = [
  "maintenance_due",
  "warranty_expiry",
  "insurance_expiry",
  "audit_due",
  "depreciation",
  "other",
] as const;
const DELIVERY_OPTIONS = ["", "pending", "sent", "failed", "read"] as const;
const STATUS_OPTIONS = ["", "active", "archived"] as const;
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
  return "outline";
}

function deliveryVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "sent") return "default";
  if (status === "read") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

export function AssetNotificationWorkspace() {
  const assetsPath = "/assets/assets";

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [assetOptions, setAssetOptions] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetMap = useMemo(
    () => new Map(assetOptions.map((asset) => [asset.id, asset])),
    [assetOptions],
  );

  const canArchive = selected?.status === "active";
  const canMarkRead =
    selected?.status === "active" && selected?.delivery_status === "sent";

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
      const payload = await notificationService.search({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        notification_type: typeFilter || undefined,
        delivery_status: deliveryFilter || undefined,
        asset_id: assetFilter || undefined,
        q: search.trim() || undefined,
        sort: "created_at",
      });
      setRows(payload.items);
      setTotal(payload.total);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load notifications",
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, deliveryFilter, assetFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const runAction = async (action: "archive" | "markRead") => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const row =
        action === "archive"
          ? await notificationService.archive(selected.id)
          : await notificationService.markRead(selected.id);
      setSelected(row);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Asset Notifications"
        description="Asset alert metadata registry. Delivery channels remain with Foundation Notification."
        actions={
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
        }
      />

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="ntf-search">Search</Label>
            <Input
              id="ntf-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Type, asset code…"
              className="transition-colors duration-200"
            />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select
              value={typeFilter || "__all__"}
              onValueChange={(v) => {
                setPage(1);
                setTypeFilter(v === "__all__" ? "" : v);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Delivery</Label>
            <Select
              value={deliveryFilter || "__all__"}
              onValueChange={(v) => {
                setPage(1);
                setDeliveryFilter(v === "__all__" ? "" : v);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All delivery" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_OPTIONS.map((d) => (
                  <SelectItem key={d || "__all__"} value={d || "__all__"}>
                    {d || "All delivery"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={statusFilter || "__all__"}
              onValueChange={(v) => {
                setPage(1);
                setStatusFilter(v === "__all__" ? "" : v);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s || "__all__"} value={s || "__all__"}>
                    {s || "All status"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Asset</Label>
            <Select
              value={assetFilter || "__all__"}
              onValueChange={(v) => {
                setPage(1);
                setAssetFilter(v === "__all__" ? "" : v);
              }}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="All assets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All assets</SelectItem>
                {assetOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.asset_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notifications ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Type</th>
                      <th className="py-2 pr-2 font-medium">Asset</th>
                      <th className="py-2 pr-2 font-medium">Delivery</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const asset = assetMap.get(row.asset_id);
                      const selectedRow = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-b transition-colors duration-200 hover:bg-muted/50 ${
                            selectedRow ? "bg-muted/60" : ""
                          }`}
                          onClick={() => setSelected(row)}
                        >
                          <td className="py-2 pr-2">{row.notification_type}</td>
                          <td className="py-2 pr-2">
                            {asset?.asset_code ?? row.asset_id.slice(0, 8)}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge variant={deliveryVariant(row.delivery_status)}>
                              {row.delivery_status}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selected ? (
              <p className="text-muted-foreground">Select a notification to view metadata.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={deliveryVariant(selected.delivery_status)}>
                    {selected.delivery_status}
                  </Badge>
                  <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                </div>
                <dl className="grid gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Type</dt>
                    <dd>{selected.notification_type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Asset</dt>
                    <dd>
                      {assetMap.get(selected.asset_id)?.asset_code ?? selected.asset_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Recipient user</dt>
                    <dd>{selected.recipient_user_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Recipient employee</dt>
                    <dd>{selected.recipient_employee_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sent at</dt>
                    <dd>{selected.sent_at ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Payload</dt>
                    <dd>
                      <pre className="mt-1 max-h-48 overflow-auto rounded border bg-muted/30 p-2 text-xs">
                        {selected.payload_json
                          ? JSON.stringify(selected.payload_json, null, 2)
                          : "null"}
                      </pre>
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2 pt-2">
                  {canMarkRead ? (
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void runAction("markRead")}
                    >
                      <CheckCheck className="mr-1 h-4 w-4" />
                      Mark read
                    </Button>
                  ) : null}
                  {canArchive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={actionLoading}
                      onClick={() => void runAction("archive")}
                    >
                      <Archive className="mr-1 h-4 w-4" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
