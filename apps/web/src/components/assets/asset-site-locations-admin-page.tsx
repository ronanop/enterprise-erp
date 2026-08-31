"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import { fetchMyDomainAccess } from "@/services/asset-domain-membership-service";
import {
  createSiteBuilding,
  createSiteLocation,
  deactivateSiteBuilding,
  deactivateSiteLocation,
  listSiteBuildings,
  listSiteLocations,
  updateSiteBuilding,
  updateSiteLocation,
  type SiteBuilding,
  type SiteLocation,
} from "@/services/asset-site-location-service";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function AssetSiteLocationsAdminPage() {
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [locations, setLocations] = useState<SiteLocation[]>([]);
  const [buildings, setBuildings] = useState<SiteBuilding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locName, setLocName] = useState("");
  const [locHo, setLocHo] = useState(false);
  const [bldName, setBldName] = useState("");
  const [editingLoc, setEditingLoc] = useState<SiteLocation | null>(null);
  const [editingBld, setEditingBld] = useState<SiteBuilding | null>(null);

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

  useEffect(() => {
    if (accessChecked && !canManage) {
      router.replace("/assets");
    }
  }, [accessChecked, canManage, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const locs = await listSiteLocations(query || undefined);
      setLocations(locs);
      if (locs.length > 0) {
        const keep =
          selectedId && locs.some((l) => l.id === selectedId)
            ? selectedId
            : locs[0]!.id;
        setSelectedId(keep);
        const blds = await listSiteBuildings(keep);
        setBuildings(blds);
      } else {
        setSelectedId(null);
        setBuildings([]);
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to load locations"));
    } finally {
      setLoading(false);
    }
  }, [query, selectedId]);

  useEffect(() => {
    if (!accessChecked || !canManage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + query
  }, [accessChecked, canManage, query]);

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  async function selectLocation(id: string) {
    setSelectedId(id);
    setEditingLoc(null);
    setEditingBld(null);
    try {
      setBuildings(await listSiteBuildings(id));
    } catch (err) {
      setError(formatApiError(err, "Failed to load buildings"));
    }
  }

  async function onCreateLocation() {
    if (!locName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const row = await createSiteLocation({
        name: locName.trim(),
        is_head_office: locHo,
      });
      setLocName("");
      setLocHo(false);
      await load();
      await selectLocation(row.id);
    } catch (err) {
      setError(formatApiError(err, "Failed to create location"));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveLocation() {
    if (!editingLoc) return;
    setSaving(true);
    setError(null);
    try {
      await updateSiteLocation(editingLoc.id, {
        name: editingLoc.name,
        is_head_office: editingLoc.is_head_office,
      });
      setEditingLoc(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Failed to update location"));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateBuilding() {
    if (!selectedId || !bldName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSiteBuilding({ location_id: selectedId, name: bldName.trim() });
      setBldName("");
      setBuildings(await listSiteBuildings(selectedId));
    } catch (err) {
      setError(formatApiError(err, "Failed to create building"));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBuilding() {
    if (!editingBld || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await updateSiteBuilding(editingBld.id, { name: editingBld.name });
      setEditingBld(null);
      setBuildings(await listSiteBuildings(selectedId));
    } catch (err) {
      setError(formatApiError(err, "Failed to update building"));
    } finally {
      setSaving(false);
    }
  }

  if (!accessChecked) {
    return <p className="text-sm text-muted-foreground">Checking access…</p>;
  }
  if (!canManage) return null;

  return (
    <div className="space-y-5" data-testid="asset-site-locations-admin">
      <PageHeader
        title="Locations"
        description="Location → Building master for IT Assets. Exactly one Location per company may be Head Office."
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locations…"
              className="h-9 pl-8"
            />
          </div>
          <ul className="max-h-[420px] space-y-0.5 overflow-y-auto">
            {loading && locations.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</li>
            ) : locations.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">No locations yet</li>
            ) : (
              locations.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    onClick={() => void selectLocation(loc.id)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 ${
                      selectedId === loc.id
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{loc.name}</span>
                    {loc.is_head_office ? (
                      <Badge variant="secondary" className="text-[10px]">
                        HO
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs font-medium text-muted-foreground">Add Location</p>
            <Input
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              placeholder="e.g. Mumbai"
              className="h-9"
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={locHo}
                onChange={(e) => setLocHo(e.target.checked)}
                className="cursor-pointer"
              />
              Head Office (only one per company)
            </label>
            <Button
              type="button"
              size="sm"
              className="h-8 w-full cursor-pointer gap-1"
              disabled={!locName.trim() || saving}
              onClick={() => void onCreateLocation()}
            >
              <Plus className="size-3.5" />
              Add Location
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          {!selected ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Select or create a Location to manage buildings.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.is_head_office
                      ? "Head Office — only one Location may hold this flag"
                      : "Not Head Office"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setEditingLoc({ ...selected })}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-destructive"
                    disabled={saving}
                    onClick={() =>
                      void (async () => {
                        setSaving(true);
                        try {
                          await deactivateSiteLocation(selected.id);
                          await load();
                        } catch (err) {
                          setError(formatApiError(err, "Failed to remove location"));
                        } finally {
                          setSaving(false);
                        }
                      })()
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {editingLoc ? (
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={editingLoc.name}
                      onChange={(e) =>
                        setEditingLoc((s) => (s ? { ...s, name: e.target.value } : s))
                      }
                      className="h-9"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={editingLoc.is_head_office}
                      onChange={(e) =>
                        setEditingLoc((s) =>
                          s ? { ...s, is_head_office: e.target.checked } : s,
                        )
                      }
                      className="cursor-pointer"
                    />
                    Head Office
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 cursor-pointer"
                    disabled={saving}
                    onClick={() => void onSaveLocation()}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 cursor-pointer"
                    onClick={() => setEditingLoc(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">Buildings</h3>
                </div>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                  {buildings.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No buildings yet
                    </li>
                  ) : (
                    buildings.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        {editingBld?.id === b.id ? (
                          <Input
                            value={editingBld.name}
                            onChange={(e) =>
                              setEditingBld((s) => (s ? { ...s, name: e.target.value } : s))
                            }
                            className="h-8 max-w-xs"
                          />
                        ) : (
                          <span>{b.name}</span>
                        )}
                        <div className="flex gap-1">
                          {editingBld?.id === b.id ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 cursor-pointer"
                                onClick={() => void onSaveBuilding()}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 cursor-pointer"
                                onClick={() => setEditingBld(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 cursor-pointer"
                                onClick={() => setEditingBld({ ...b })}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 cursor-pointer text-destructive"
                                onClick={() =>
                                  void (async () => {
                                    setSaving(true);
                                    try {
                                      await deactivateSiteBuilding(b.id);
                                      setBuildings(await listSiteBuildings(selectedId!));
                                    } catch (err) {
                                      setError(formatApiError(err, "Failed to remove building"));
                                    } finally {
                                      setSaving(false);
                                    }
                                  })()
                                }
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={bldName}
                    onChange={(e) => setBldName(e.target.value)}
                    placeholder="Building name (e.g. CRC2)"
                    className="h-9 max-w-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 cursor-pointer gap-1"
                    disabled={!bldName.trim() || saving}
                    onClick={() => void onCreateBuilding()}
                  >
                    <Plus className="size-3.5" />
                    Add Building
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
