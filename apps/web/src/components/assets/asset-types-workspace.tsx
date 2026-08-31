"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, LayoutGrid, Plus, Search, Tags } from "lucide-react";

import { EmptyState } from "@/components/assets/shared";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_ICON_CHIP,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";
import {
  createItAssetType,
  deactivateItAssetType,
  listItAssetTypes,
  reactivateItAssetType,
  updateItAssetType,
  type ItAssetType,
} from "@/services/asset-type-service";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function AssetTypesWorkspace() {
  const [accessChecked, setAccessChecked] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [rows, setRows] = useState<ItAssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [requiresHardware, setRequiresHardware] = useState(false);
  const [eligibleAsComponent, setEligibleAsComponent] = useState(true);
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyDomainAccess();
        const admin =
          me.is_module_admin ||
          (me.admin_domains ?? []).map((d) => d.toUpperCase()).includes("IT");
        if (!cancelled) setCanManage(admin);
      } catch {
        if (!cancelled) setCanManage(false);
      } finally {
        if (!cancelled) setAccessChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listItAssetTypes());
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load asset types"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessChecked) void load();
  }, [accessChecked, load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setRequiresHardware(false);
    setEligibleAsComponent(true);
    setDescription("");
  }

  function startEdit(row: ItAssetType) {
    setEditingId(row.id);
    setName(row.name);
    setRequiresHardware(row.requires_hardware_config);
    setEligibleAsComponent(row.eligible_as_component !== false);
    setDescription(row.description ?? "");
    setError(null);
  }

  async function onSave() {
    if (!canManage) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      requires_hardware_config: requiresHardware,
      eligible_as_component: eligibleAsComponent,
      description: description.trim() || null,
    };
    try {
      if (editingId) {
        const current = rows.find((r) => r.id === editingId);
        await updateItAssetType(editingId, {
          ...payload,
          version: current?.version,
        });
      } else {
        await createItAssetType(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(formatApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ItAssetType) {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      if (row.active) {
        await deactivateItAssetType(row.id);
      } else {
        await reactivateItAssetType(row.id);
      }
      await load();
    } catch (err) {
      setError(formatApiError(err, row.active ? "Deactivate failed" : "Activate failed"));
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "ACTIVE" && !row.active) return false;
      if (statusFilter === "INACTIVE" && row.active) return false;
      if (!q) return true;
      const hay = [row.name, row.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  const activeCount = rows.filter((r) => r.active).length;
  const hardwareCount = rows.filter((r) => r.requires_hardware_config).length;

  if (!accessChecked) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Checking access…</div>
    );
  }

  return (
    <AssetsPremiumPage testId="it-asset-types-admin">
      <PageHeader
        title="Asset Types"
        description={
          canManage
            ? "Manage IT asset types and whether registration collects hardware configuration."
            : "IT asset type catalog (read-only). Contact an IT admin to add or change types."
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 bg-background/90 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={ASSETS_ICON_CHIP}>
              <Tags className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total types
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/90 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <LayoutGrid className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Active
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/90 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Cpu className="size-4" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Hardware config
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{hardwareCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Card className={cn(ASSETS_SURFACE_CARD, "overflow-hidden")}>
          <CardHeader className="border-b border-border/50 pb-4 pt-5">
            <CardTitle className="text-sm font-semibold tracking-tight">
              {editingId ? "Edit asset type" : "Add asset type"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Types drive Add Asset and inventory filters. Hardware fields appear when enabled.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="it-type-name">
                  Display name
                </label>
                <Input
                  id="it-type-name"
                  placeholder="e.g. Laptop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="it-type-description"
                >
                  Description
                </label>
                <Input
                  id="it-type-description"
                  placeholder="Optional — what this type covers"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-10"
                  disabled={saving}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 px-3.5 py-3 transition-colors duration-200 hover:border-[#0369A1]/40">
              <input
                type="checkbox"
                className="mt-1 size-4 cursor-pointer rounded border-input"
                checked={requiresHardware}
                onChange={(e) => setRequiresHardware(e.target.checked)}
                disabled={saving}
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Requires hardware configuration
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  Show processor, generation, RAM, and storage on Add Asset for this type.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/10 px-3.5 py-3 transition-colors duration-200 hover:border-[#0369A1]/40">
              <input
                type="checkbox"
                className="mt-1 size-4 cursor-pointer rounded border-input"
                checked={eligibleAsComponent}
                onChange={(e) => setEligibleAsComponent(e.target.checked)}
                disabled={saving}
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Eligible as component
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  Allow assets of this type to be attached as components of another asset.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={saving}
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                className={cn("cursor-pointer gap-1.5", ASSETS_ACCENT_BTN)}
                disabled={saving}
                onClick={() => void onSave()}
              >
                {!editingId ? <Plus className="size-4" aria-hidden /> : null}
                {editingId ? "Update type" : "Add type"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Card className={cn(ASSETS_SURFACE_CARD, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or description…"
              className="h-10 pl-9"
            />
          </div>
          <select
            className="h-10 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Hardware</th>
                <th className="px-4 py-2.5 font-semibold">As component</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                {canManage ? (
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="p-6">
                    <EmptyState
                      variant="no-assets"
                      title={rows.length === 0 ? "No types yet" : "No matches"}
                      description={
                        rows.length === 0
                          ? canManage
                            ? "Add types such as Laptop, Monitor, or Peripheral to start registering assets."
                            : "An IT admin needs to create asset types before registration."
                          : "Try another search or clear filters."
                      }
                      compact
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border/50 transition-colors duration-200 hover:bg-muted/20 motion-reduce:transition-none"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{row.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {row.description || "No description"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.requires_hardware_config ? (
                        <Badge variant="secondary">Required</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not required</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.eligible_as_component !== false ? (
                        <Badge variant="secondary">Eligible</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not eligible</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={row.active ? "secondary" : "outline"}>
                        {row.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer transition-colors duration-200"
                            disabled={saving}
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer transition-colors duration-200"
                            disabled={saving}
                            onClick={() => void toggleActive(row)}
                          >
                            {row.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 ? (
          <div className="border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {rows.length} types
          </div>
        ) : null}
      </Card>
    </AssetsPremiumPage>
  );
}
