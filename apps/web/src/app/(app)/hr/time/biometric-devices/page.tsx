"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Download, Plus, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

const DEVICE_MODELS = [
  {
    value: "fingerprint_k40_zkteco_pro",
    label: "ZKTeco K40 Pro",
    defaultName: "ZKTeco K40 Pro",
    defaultPort: "4370",
  },
  {
    value: "fingerprint_k40_timelabs",
    label: "Fingerprint K40 TimeLabs",
    defaultName: "Fingerprint K40 TimeLabs",
    defaultPort: "4370",
  },
] as const;

type Device = {
  id: string;
  device_code: string;
  device_name: string;
  device_model?: string | null;
  ip_address?: string | null;
  port?: number | null;
  subnet_mask?: string | null;
  gateway?: string | null;
  comm_password?: string | null;
  location_text?: string | null;
  status: string;
  branch_id: string;
};

type Option = { id: string; label: string };

type LiveLogItem = {
  id: string;
  employee_id: string;
  employee_code?: string | null;
  employee_name?: string | null;
  attendance_date: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  attendance_status: string;
  notes?: string | null;
  updated_at?: string | null;
};

type LiveFeed = {
  device: Device;
  reachable: boolean;
  reachability_message: string;
  today_ingested_count: number;
  ingested_records: LiveLogItem[];
};

function modelLabel(value?: string | null) {
  return DEVICE_MODELS.find((m) => m.value === value)?.label ?? value ?? "-";
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** Next free K40-NN from existing codes (avoids 409 when list length ≠ highest suffix). */
function nextDeviceCode(devices: Device[]): string {
  let maxN = 0;
  for (const d of devices) {
    const m = /^K40-(\d+)$/i.exec((d.device_code || "").trim());
    if (m) maxN = Math.max(maxN, Number.parseInt(m[1], 10) || 0);
  }
  return `K40-${String(maxN + 1).padStart(2, "0")}`;
}

export default function BiometricDevicesPage() {
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Option[]>([]);
  const [branchId, setBranchId] = useState("");
  const [deviceModel, setDeviceModel] = useState<string>(DEVICE_MODELS[0].value);
  const [deviceCode, setDeviceCode] = useState("K40-01");
  const [deviceName, setDeviceName] = useState<string>(DEVICE_MODELS[0].defaultName);
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState<string>(DEVICE_MODELS[0].defaultPort);
  const [subnetMask, setSubnetMask] = useState("255.255.255.0");
  const [gateway, setGateway] = useState("0.0.0.0");
  const [commPassword, setCommPassword] = useState("0");
  const [location, setLocation] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [feedDevice, setFeedDevice] = useState<Device | null>(null);
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadingLock = useRef(false);

  const loadFeed = useCallback(async (deviceId: string) => {
    setFeedLoading(true);
    try {
      const res = await apiClient<LiveFeed>(`/hr/biometric-devices/${deviceId}/live-feed`, {
        method: "GET",
        query: { days: 14 },
      });
      setFeed(res.data ?? null);
    } catch {
      toast("Failed to load device feed", "error");
      setFeed(null);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const openDeviceFeed = useCallback(
    (device: Device) => {
      setFeedDevice(device);
      setFeed(null);
      void loadFeed(device.id);
    },
    [loadFeed],
  );

  const closeDeviceFeed = useCallback(() => {
    setFeedDevice(null);
    setFeed(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resourceService.list("/hr/biometric-devices", { page_size: 100 });
      setRows((Array.isArray(res.data) ? res.data : []) as Device[]);
    } catch {
      toast("Failed to load biometric devices", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const res = await resourceService.list("/branches", { page_size: 200 });
      const list = Array.isArray(res.data) ? res.data : [];
      const opts = list.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
        };
      });
      setBranches(opts);
      setBranchId((prev) => prev || opts[0]?.id || "");
    } catch {
      toast("Failed to load branches", "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadLogs = useCallback(
    async (device: Device, opts?: { silent?: boolean }) => {
      if (downloadingLock.current) return;
      downloadingLock.current = true;
      setDownloadingId(device.id);
      try {
        const res = await apiClient<{
          logs_read: number;
          created: number;
          updated: number;
          skipped: number;
        }>(`/hr/biometric-devices/${device.id}/download`, { method: "POST" });
        const data = res.data;
        const read = data?.logs_read ?? 0;
        const saved = (data?.created ?? 0) + (data?.updated ?? 0);
        const skipped = data?.skipped ?? 0;
        if (!opts?.silent) {
          if (read === 0) {
            toast("Connected. No punch logs in the last 31 days.", "success");
          } else if (saved === 0) {
            toast(
              `Read ${read} punches. None matched an employee code (use CT codes on the K40).`,
              "error",
            );
          } else {
            const skipNote = skipped ? ` · ${skipped} unmatched codes skipped` : "";
            toast(`Saved ${saved} attendance rows from ${read} punches${skipNote}.`, "success");
          }
        } else if (saved > 0) {
          toast(`Auto-sync: ${saved} attendance row(s) updated.`, "success");
        }
        if (feedDevice?.id === device.id) void loadFeed(device.id);
      } catch (err) {
        if (!opts?.silent) {
          toast(
            err instanceof ApiClientError ? err.message : "Could not download attendance",
            "error",
          );
        }
      } finally {
        downloadingLock.current = false;
        setDownloadingId(null);
      }
    },
    [feedDevice?.id, loadFeed],
  );

  useEffect(() => {
    if (!feedDevice) return;
    // Sync punches from the K40 every 1 minute, then refresh the feed.
    const id = window.setInterval(() => {
      void downloadLogs(feedDevice, { silent: true });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [feedDevice, downloadLogs]);

  function openCreate() {
    const model = DEVICE_MODELS[0];
    setDeviceModel(model.value);
    setDeviceCode(nextDeviceCode(rows));
    setDeviceName(model.defaultName);
    setIpAddress("");
    setPort(model.defaultPort);
    setSubnetMask("255.255.255.0");
    setGateway("0.0.0.0");
    setCommPassword("0");
    setLocation("");
    setCreatedApiKey(null);
    setOpen(true);
    void loadBranches();
  }

  function onModelChange(value: string) {
    setDeviceModel(value);
    const model = DEVICE_MODELS.find((m) => m.value === value);
    if (model) {
      setDeviceName(model.defaultName);
      setPort(model.defaultPort);
    }
  }

  async function removeDevice(device: Device) {
    if (deletingId) return;
    const ok = window.confirm(
      `Remove ${device.device_code} (${device.device_name})? Attendance already saved stays in place.`,
    );
    if (!ok) return;
    setDeletingId(device.id);
    try {
      await resourceService.delete("/hr/biometric-devices", device.id);
      toast("Device removed", "success");
      if (feedDevice?.id === device.id) closeDeviceFeed();
      await load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not remove device", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function submit() {
    const code = deviceCode.trim();
    const name = deviceName.trim();
    const ip = ipAddress.trim();
    const portNum = Number(port);
    if (!branchId) {
      toast("Select a branch", "error");
      return;
    }
    if (!code || !name) {
      toast("Device code and name are required", "error");
      return;
    }
    if (!ip) {
      toast("IP address is required", "error");
      return;
    }
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      toast("Enter a valid port (1-65535)", "error");
      return;
    }
    const mask = subnetMask.trim();
    const gw = gateway.trim();
    const comm = commPassword.trim();
    if (mask && !IPV4.test(mask)) {
      toast("Subnet mask must be an IPv4 address", "error");
      return;
    }
    if (gw && !IPV4.test(gw)) {
      toast("Gateway must be an IPv4 address", "error");
      return;
    }
    if (comm && comm !== "0" && !/^\d{1,6}$/.test(comm)) {
      toast("Communication password must be 0, or 1 to 6 digits", "error");
      return;
    }

    setSaving(true);
    try {
      const created = await resourceService.create("/hr/biometric-devices", {
        branch_id: branchId,
        device_code: code,
        device_name: name,
        device_model: deviceModel,
        ip_address: ip,
        port: portNum,
        subnet_mask: mask || null,
        gateway: gw || null,
        comm_password: comm || "0",
        location_text: location.trim() || null,
        status: "active",
      });
      const apiKey = (created.data as { api_key?: string } | undefined)?.api_key ?? null;
      setCreatedApiKey(apiKey);
      toast("Device registered", "success");
      void load();
      if (!apiKey) setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Create failed";
      toast(
        message.includes("already")
          ? message
          : message || "Device code may already exist — try a different code.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Biometric devices"
        description="Register a ZKTeco K40 Pro with the IP, subnet, gateway, port, and communication password from the device Comm. menu."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              Add device
            </Button>
          </div>
        }
      />

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {!rows.length ? (
          <p className="p-4 text-sm text-muted-foreground">No biometric devices registered</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">IP / Port</th>
                  <th className="px-3 py-2 font-medium">Subnet / Gateway</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="sticky right-0 z-10 bg-muted px-3 py-2 text-right font-medium shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.2)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors duration-150 hover:bg-muted/30"
                    onClick={() => openDeviceFeed(r)}
                  >
                    <td className="px-3 py-2 font-medium">{r.device_code}</td>
                    <td className="px-3 py-2 text-muted-foreground">{modelLabel(r.device_model)}</td>
                    <td className="px-3 py-2">{r.device_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.ip_address ? `${r.ip_address}:${r.port ?? "-"}` : "-"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {r.subnet_mask || "-"}
                      <span className="mt-0.5 block">{r.gateway || "-"}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.location_text || "-"}</td>
                    <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{r.status}</td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-2 text-right whitespace-nowrap shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer transition-colors duration-200"
                        disabled={downloadingId === r.id}
                        aria-label={`Download punches from ${r.device_code}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void downloadLogs(r);
                        }}
                      >
                        <Download className="size-3.5" />
                        {downloadingId === r.id ? "Downloading…" : "Download punches"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer text-destructive transition-colors duration-200 hover:bg-destructive/10"
                        disabled={deletingId === r.id}
                        aria-label={`Remove ${r.device_code}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeDevice(r);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        {deletingId === r.id ? "Removing…" : "Remove"}
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SetupDrawer
        open={!!feedDevice}
        wide
        title={feedDevice ? `${feedDevice.device_code} · Live feed` : "Device feed"}
        description={
          feedDevice
            ? `${feedDevice.device_name} · ${feedDevice.ip_address ?? "-"}:${feedDevice.port ?? "-"}`
            : undefined
        }
        onClose={closeDeviceFeed}
        footer={
          feedDevice ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void downloadLogs(feedDevice)}
                disabled={downloadingId === feedDevice.id}
              >
                <Download className="size-3.5" />
                {downloadingId === feedDevice.id ? "Downloading…" : "Download punches"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void loadFeed(feedDevice.id)}
                disabled={feedLoading}
              >
                <RefreshCw className={cn("size-3.5", feedLoading && "animate-spin")} />
                Refresh feed
              </Button>
            </div>
          ) : null
        }
      >
        {feedLoading && !feed ? (
          <p className="text-sm text-muted-foreground">Loading device data…</p>
        ) : feed ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex gap-3 rounded-lg border px-3 py-2.5 text-sm",
                feed.reachable
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                  : "border-amber-200 bg-amber-50/80 text-amber-950",
              )}
            >
              {feed.reachable ? (
                <Wifi className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-medium">{feed.reachable ? "Device reachable" : "Device not reachable"}</p>
                <p className="mt-0.5 text-xs opacity-90">{feed.reachability_message}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <Activity className="size-4 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium tabular-nums">{feed.today_ingested_count}</span>
                <span className="text-muted-foreground"> punches ingested today (via device-sync)</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Matches K40 user IDs to employee codes (e.g. CT5353). Auto-syncs every 1 minute while this panel is open.
            </p>

            {!feed.ingested_records.length ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No ingested punches for this device in the last 14 days.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Employee</th>
                      <th className="px-3 py-2 font-medium">In</th>
                      <th className="px-3 py-2 font-medium">Out</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {feed.ingested_records.map((row) => (
                      <tr key={row.id} className="transition-colors duration-150 hover:bg-muted/20">
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{row.attendance_date}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{row.employee_name || "-"}</span>
                          {row.employee_code ? (
                            <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                              {row.employee_code}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.check_in_at)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.check_out_at)}
                        </td>
                        <td className="px-3 py-2 text-xs uppercase text-muted-foreground">
                          {row.attendance_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load feed.</p>
        )}
      </SetupDrawer>

      <SetupDrawer
        open={open}
        title={createdApiKey ? "Device registered" : "Add biometric device"}
        description={
          createdApiKey
            ? "Copy the API key now - it will not be shown again."
            : "Copy IP, subnet mask, gateway, port 4370, and the communication password from the K40 Comm. menu."
        }
        onClose={() => setOpen(false)}
        footer={
          createdApiKey ? (
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void submit()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Register device"}
              </Button>
            </>
          )
        }
      >
        {createdApiKey ? (
          <div className="space-y-3">
            <SetupField label="API key" hint="Store this securely for device-sync authentication.">
              <SetupInput readOnly value={createdApiKey} className="font-mono text-xs" />
            </SetupField>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                void navigator.clipboard.writeText(createdApiKey);
                toast("API key copied", "success");
              }}
            >
              Copy API key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <SetupField label="Device model" required>
              <SetupSelect value={deviceModel} onChange={(e) => onModelChange(e.target.value)}>
                {DEVICE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Branch" required>
              <SetupSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Device code" required>
              <SetupInput
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value)}
                placeholder="K40-01"
              />
            </SetupField>
            <SetupField label="Device name" required>
              <SetupInput
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="ZKTeco K40 Pro"
              />
            </SetupField>
            <div className="grid grid-cols-2 gap-3">
              <SetupField label="IP address" required hint="Device LAN / WAN IP">
                <SetupInput
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.50"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </SetupField>
              <SetupField label="Port" required hint="Default ZK / TimeLabs 4370">
                <SetupInput
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="4370"
                  inputMode="numeric"
                />
              </SetupField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SetupField label="Subnet mask" hint="Device Comm. menu. Default 255.255.255.0">
                <SetupInput
                  value={subnetMask}
                  onChange={(e) => setSubnetMask(e.target.value)}
                  placeholder="255.255.255.0"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </SetupField>
              <SetupField label="Gateway" hint="Device Comm. menu. Default 0.0.0.0">
                <SetupInput
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="0.0.0.0"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </SetupField>
            </div>
            <SetupField
              label="Communication password"
              hint="From the device Comm. menu. 0 means no password. 1 to 6 digits."
            >
              <SetupInput
                value={commPassword}
                onChange={(e) => setCommPassword(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
              />
            </SetupField>
            <SetupField label="Location" hint="Optional gate / floor label">
              <SetupInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main gate"
              />
            </SetupField>
          </div>
        )}
      </SetupDrawer>
    </div>
  );
}
