"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Car,
  Coffee,
  DoorOpen,
  Landmark,
  Layers,
  LayoutGrid,
  MapPin,
  Plus,
  Presentation,
  Search,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import {
  EmptyState,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";
import {
  createNonItLocation,
  listNonItLocations,
  updateNonItLocation,
  type NonItLocation,
  type NonItLocationKind,
} from "@/services/nonit-asset-service";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type KindMeta = {
  value: NonItLocationKind;
  label: string;
  hint: string;
  icon: LucideIcon;
  nameHint: string;
};

const LOCATION_KINDS: KindMeta[] = [
  {
    value: "CONFERENCE_ROOM",
    label: "Conference room",
    hint: "Large AV / board setups",
    icon: Presentation,
    nameHint: "e.g. Conference Room A",
  },
  {
    value: "MEETING_ROOM",
    label: "Meeting room",
    hint: "Small huddle spaces",
    icon: Users,
    nameHint: "e.g. Meeting Room 2",
  },
  {
    value: "DEPARTMENT",
    label: "Department",
    hint: "Team / wing areas",
    icon: Building2,
    nameHint: "e.g. Finance Department",
  },
  {
    value: "FLOOR",
    label: "Floor",
    hint: "Whole floor zones",
    icon: Layers,
    nameHint: "e.g. Floor 3 Open Plan",
  },
  {
    value: "CABIN",
    label: "Cabin",
    hint: "Private offices",
    icon: DoorOpen,
    nameHint: "e.g. Cabin 12",
  },
  {
    value: "LOBBY",
    label: "Lobby",
    hint: "Reception / entry",
    icon: Landmark,
    nameHint: "e.g. Main Lobby",
  },
  {
    value: "CAFETERIA",
    label: "Cafeteria",
    hint: "Pantry / dining",
    icon: Coffee,
    nameHint: "e.g. Staff Cafeteria",
  },
  {
    value: "COMMON_AREA",
    label: "Common area",
    hint: "Corridors, lounges",
    icon: LayoutGrid,
    nameHint: "e.g. East Lounge",
  },
  {
    value: "WAREHOUSE",
    label: "Warehouse",
    hint: "Stores / stock",
    icon: Warehouse,
    nameHint: "e.g. Facilities Store",
  },
  {
    value: "PARKING",
    label: "Parking",
    hint: "Basement / lot",
    icon: Car,
    nameHint: "e.g. Basement Parking B1",
  },
  {
    value: "OTHER",
    label: "Other",
    hint: "Custom places",
    icon: MapPin,
    nameHint: "e.g. Server Closet",
  },
];

const KIND_MAP = Object.fromEntries(LOCATION_KINDS.map((k) => [k.value, k])) as Record<
  NonItLocationKind,
  KindMeta
>;

function kindMeta(kind: string | null | undefined): KindMeta {
  const key = (kind ?? "OTHER") as NonItLocationKind;
  return KIND_MAP[key] ?? KIND_MAP.OTHER;
}

function locationPath(row: NonItLocation): string {
  const parts = [row.building, row.floor ? `Fl. ${row.floor}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function NonItLocationsAdminPage() {
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [rows, setRows] = useState<NonItLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<NonItLocationKind>("CONFERENCE_ROOM");
  const [code, setCode] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [remarks, setRemarks] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<NonItLocationKind | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyDomainAccess();
        const admin =
          me.is_module_admin ||
          (me.admin_domains ?? []).map((d) => d.toUpperCase()).includes("NON_IT");
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

  useEffect(() => {
    if (accessChecked && !canManage) {
      router.replace("/assets/non-it");
    }
  }, [accessChecked, canManage, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listNonItLocations());
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load locations"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setKind("CONFERENCE_ROOM");
    setCode("");
    setBuilding("");
    setFloor("");
    setRemarks("");
  }

  function startEdit(row: NonItLocation) {
    setEditingId(row.id);
    setName(row.name);
    setKind(row.location_kind ?? "OTHER");
    setCode(row.code ?? "");
    setBuilding(row.building ?? "");
    setFloor(row.floor ?? "");
    setRemarks(row.remarks ?? "");
  }

  async function onSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      location_kind: kind,
      code: code.trim() || null,
      building: building.trim() || null,
      floor: floor.trim() || null,
      remarks: remarks.trim() || null,
    };
    try {
      if (editingId) {
        const current = rows.find((r) => r.id === editingId);
        await updateNonItLocation(editingId, {
          ...payload,
          version: current?.version,
        });
      } else {
        await createNonItLocation(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(formatApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: NonItLocation) {
    setSaving(true);
    setError(null);
    try {
      await updateNonItLocation(row.id, {
        active: !row.active,
        version: row.version,
      });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterKind !== "ALL" && (row.location_kind ?? "OTHER") !== filterKind) return false;
      if (statusFilter === "ACTIVE" && !row.active) return false;
      if (statusFilter === "INACTIVE" && row.active) return false;
      if (!q) return true;
      const hay = [row.name, row.code, row.building, row.floor, row.remarks, row.location_kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filterKind, statusFilter]);

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<NonItLocationKind, number>> = {};
    for (const row of rows) {
      const k = (row.location_kind ?? "OTHER") as NonItLocationKind;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const selectedKind = kindMeta(kind);

  if (!accessChecked || !canManage) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Checking access…</div>
    );
  }

  return (
    <div className="relative space-y-6" data-testid="nonit-locations-admin">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-2 h-40 overflow-hidden rounded-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(3,105,161,0.08),_transparent_55%)]" />
      </div>

      <div className="relative space-y-6">
        <PageHeader
          title="Non-IT locations"
          description="Catalog rooms, floors, departments, and common areas used when assigning location-based assets."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/70 bg-background/90 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
                <MapPin className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total places
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
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {rows.filter((r) => r.active).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-background/90 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Building2 className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Categories in use
                </p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {Object.keys(kindCounts).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border/70 bg-background/95 shadow-md">
          <CardHeader className="border-b border-border/50 pb-4 pt-5">
            <CardTitle className="text-sm font-semibold tracking-tight">
              {editingId ? "Edit location" : "Add location"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pick a category, then fill place details. Assignment pickers use the display name.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-5 md:p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {LOCATION_KINDS.map((item) => {
                  const Icon = item.icon;
                  const selected = kind === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      disabled={saving}
                      onClick={() => setKind(item.value)}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                        selected
                          ? "border-[#0369A1] bg-[rgba(3,105,161,0.08)] shadow-sm"
                          : "border-border/70 bg-muted/10 hover:border-[#0369A1]/40 hover:bg-[rgba(3,105,161,0.03)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          selected ? "text-[#0369A1]" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="line-clamp-1 text-[10px] text-muted-foreground">
                        {item.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="loc-name">
                  Display name
                </label>
                <Input
                  id="loc-name"
                  placeholder={selectedKind.nameHint}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="loc-code">
                  Short code
                </label>
                <Input
                  id="loc-code"
                  placeholder="e.g. CR-A"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-10 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="loc-floor">
                  Floor
                </label>
                <Input
                  id="loc-floor"
                  placeholder="e.g. 3 / Ground"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="loc-building">
                  Building / block
                </label>
                <Input
                  id="loc-building"
                  placeholder="e.g. Tower A · Annex"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="loc-remarks">
                  Notes
                </label>
                <Input
                  id="loc-remarks"
                  placeholder="Optional — wing, capacity, landmarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground">
                Saving as <span className="font-medium text-foreground">{selectedKind.label}</span>
              </p>
              <div className="flex gap-2">
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
                  className="cursor-pointer gap-1.5 bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90"
                  disabled={saving}
                  onClick={() => void onSave()}
                >
                  {!editingId ? <Plus className="size-4" aria-hidden /> : null}
                  {editingId ? "Update location" : "Add location"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden border-border/70 bg-background/95 shadow-md">
          <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, building…"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value as NonItLocationKind | "ALL")}
                aria-label="Filter by category"
              >
                <option value="ALL">All categories</option>
                {LOCATION_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                    {kindCounts[k.value] ? ` (${kindCounts[k.value]})` : ""}
                  </option>
                ))}
              </select>
              <select
                className="h-10 cursor-pointer rounded-md border border-input bg-background px-3 text-sm transition-colors duration-200"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
                }
                aria-label="Filter by status"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-4 py-2.5 font-semibold">Location</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Place</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <EmptyState
                        variant="no-assets"
                        title={rows.length === 0 ? "No locations yet" : "No matches"}
                        description={
                          rows.length === 0
                            ? "Add conference rooms, meeting rooms, floors, and departments for Non-IT assignments."
                            : "Try another search or clear filters."
                        }
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, index) => {
                    const meta = kindMeta(row.location_kind);
                    const Icon = meta.icon;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-border/50 transition-colors duration-200 hover:bg-muted/20 motion-reduce:transition-none"
                      >
                        <td className={tableSerialCellClassName()}>{tableRowSerialFromIndex(index)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.08)] text-[#0369A1]">
                              <Icon className="size-3.5" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{row.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {row.code ? (
                                  <span className="font-mono">{row.code}</span>
                                ) : (
                                  "No code"
                                )}
                                {row.remarks ? ` · ${row.remarks}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground">
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{locationPath(row)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={row.active ? "secondary" : "outline"}>
                            {row.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 ? (
            <div className="border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} locations
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
