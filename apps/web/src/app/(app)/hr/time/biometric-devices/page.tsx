"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { ApiClientError, resourceService } from "@/services/api-client";

const DEVICE_MODELS = [
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
  location_text?: string | null;
  status: string;
  branch_id: string;
};

type Option = { id: string; label: string };

function modelLabel(value?: string | null) {
  return DEVICE_MODELS.find((m) => m.value === value)?.label ?? value ?? "—";
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
  const [deviceName, setDeviceName] = useState(DEVICE_MODELS[0].defaultName);
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(DEVICE_MODELS[0].defaultPort);
  const [location, setLocation] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

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

  function openCreate() {
    const model = DEVICE_MODELS[0];
    setDeviceModel(model.value);
    setDeviceCode(`K40-${String(rows.length + 1).padStart(2, "0")}`);
    setDeviceName(model.defaultName);
    setIpAddress("");
    setPort(model.defaultPort);
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
      toast("Enter a valid port (1–65535)", "error");
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
        location_text: location.trim() || null,
        status: "active",
      });
      const apiKey = (created.data as { api_key?: string } | undefined)?.api_key ?? null;
      setCreatedApiKey(apiKey);
      toast("Device registered", "success");
      void load();
      if (!apiKey) setOpen(false);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Create failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Biometric devices"
        description="Register Fingerprint K40 TimeLabs devices by IP and port. Sync punches via POST /hr/attendance/device-sync."
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
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">IP / Port</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors duration-150 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.device_code}</td>
                    <td className="px-3 py-2 text-muted-foreground">{modelLabel(r.device_model)}</td>
                    <td className="px-3 py-2">{r.device_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.ip_address ? `${r.ip_address}:${r.port ?? "—"}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.location_text || "—"}</td>
                    <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SetupDrawer
        open={open}
        title={createdApiKey ? "Device registered" : "Add biometric device"}
        description={
          createdApiKey
            ? "Copy the API key now — it will not be shown again."
            : "Register a Fingerprint K40 TimeLabs device using network IP and port."
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
                placeholder="Fingerprint K40 TimeLabs"
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
              <SetupField label="Port" required hint="Default TimeLabs 4370">
                <SetupInput
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="4370"
                  inputMode="numeric"
                />
              </SetupField>
            </div>
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
