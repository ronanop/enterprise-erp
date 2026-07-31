"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { ApiClientError, resourceService } from "@/services/api-client";

type Device = {
  id: string;
  device_code: string;
  device_name: string;
  location_text?: string | null;
  status: string;
  branch_id: string;
};

export default function BiometricDevicesPage() {
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void load();
  }, [load]);

  async function createDevice() {
    const branchId = window.prompt("Branch UUID");
    const deviceCode = window.prompt("Device code", "BIO-01");
    const deviceName = window.prompt("Device name", "Main gate");
    const location = window.prompt("Location text", "") || undefined;
    if (!branchId || !deviceCode || !deviceName) return;
    try {
      await resourceService.create("/hr/biometric-devices", {
        branch_id: branchId,
        device_code: deviceCode,
        device_name: deviceName,
        location_text: location,
        status: "active",
      });
      toast("Device registered", "success");
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Create failed", "error");
    }
  }

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Biometric devices"
        description="Register devices and ingest punches via POST /hr/attendance/device-sync."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button size="sm" className="cursor-pointer" onClick={() => void createDevice()}>
              <Plus className="size-3.5" />
              Add device
            </Button>
          </div>
        }
      />

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">No biometric devices registered</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.device_code}</span> — {r.device_name}
                  {r.location_text ? (
                    <span className="ml-2 text-xs text-muted-foreground">{r.location_text}</span>
                  ) : null}
                </span>
                <span className="text-xs uppercase text-muted-foreground">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
