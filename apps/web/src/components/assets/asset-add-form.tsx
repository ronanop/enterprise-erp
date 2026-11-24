"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  Cpu,
  Loader2,
  MapPin,
  Package,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
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
import {
  INTEL_GENERATION_OPTIONS,
  PROCESSOR_OPTIONS,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  buildConfigurationString,
  isIntelProcessor,
  parseConfigurationString,
} from "@/config/asset-hardware-options";
import { isAuthenticated } from "@/lib/auth";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { listBranchOptions, type OrgOption } from "@/lib/org-options";
import { buildSelfServiceUrl } from "@/services/assets-service";
import {
  assetCategoryService,
  assetLocationService,
  assetRegisterService,
  assetRegistrationQueueService,
  componentService,
  filterActiveCategories,
  type IncomingRegistrationPrefill,
} from "@/services/assets-service";
import {
  listItAssetTypes,
  type ItAssetType,
} from "@/services/asset-type-service";
import {
  listSiteBuildings,
  listSiteLocations,
  type SiteBuilding,
  type SiteLocation,
} from "@/services/asset-site-location-service";
import { ApiClientError } from "@/services/api-client";
import {
  ItAssetImportDialog,
} from "@/components/assets/it-asset-import-dialog";
import { markInventoryStale } from "@/components/assets/inventory/inventory-refresh";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_ICON_CHIP,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { cn } from "@/lib/utils";

function normalizeLocName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Labels are often "Dubai · WFH" — compare on the city segment only. */
function cityFromLocationLabel(label: string): string {
  const raw = label.trim();
  if (!raw) return "";
  const match = raw.split(/\s*[·|–—-]\s*/)[0]?.trim();
  return match || raw;
}

/**
 * Map a saved (possibly soft-deleted) location onto an active catalog row.
 * Prefer the asset company when the same city exists in multiple companies.
 */
function resolveActiveLocationId(
  locs: SiteLocation[],
  locationId: string,
  labelHint: string,
  preferCompanyId: string | null,
): string {
  if (locationId && locs.some((l) => l.id === locationId)) return locationId;
  const city = normalizeLocName(cityFromLocationLabel(labelHint));
  if (!city) return "";
  const matches = locs.filter((l) => normalizeLocName(l.name) === city);
  if (preferCompanyId) {
    const scoped = matches.find((l) => l.company_id === preferCompanyId);
    if (scoped) return scoped.id;
  }
  return matches[0]?.id ?? "";
}

function FormSection({
  id,
  title,
  icon: Icon,
  children,
  testId,
  columns = "two",
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  testId?: string;
  columns?: "two" | "three";
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid={testId}
      className={cn(
        ASSETS_SURFACE_CARD,
        "rounded-xl border border-border/70 transition-colors duration-200",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3 sm:px-5">
        <span className={ASSETS_ICON_CHIP} aria-hidden>
          <Icon className="size-4" />
        </span>
        <h2 id={id} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <div
        className={cn(
          "grid gap-3.5 p-4 sm:gap-4 sm:p-5",
          columns === "three" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {children}
      </div>
    </section>
  );
}

type FieldErrors = Partial<
  Record<
    | "asset_name"
    | "asset_category_id"
    | "asset_type_id"
    | "make"
    | "model"
    | "processor"
    | "generation"
    | "ram"
    | "storage"
    | "location_id"
    | "building_id"
    | "charger_available"
    | "charger_code",
    string
  >
>;

type AssetAddFormProps = {
  incomingUnitId?: string;
  incomingLineId?: string;
  /** When set, form loads the asset and PATCHes on save (Edit Asset). */
  assetId?: string;
};

export function AssetAddForm({
  incomingUnitId,
  incomingLineId,
  assetId,
}: AssetAddFormProps = {}) {
  const router = useRouter();
  const isEdit = Boolean(assetId);
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [siteBuildings, setSiteBuildings] = useState<SiteBuilding[]>([]);
  /** Location id that `siteBuildings` was fetched for (avoids stale Address options). */
  const [buildingsForLocationId, setBuildingsForLocationId] = useState("");
  const [assetTypes, setAssetTypes] = useState<ItAssetType[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [activationWarning, setActivationWarning] = useState<string | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<number | null>(null);
  /** Asset company when editing — used to prefer matching asset types. */
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [initialLocationId, setInitialLocationId] = useState<string>("");
  const [initialBuildingId, setInitialBuildingId] = useState<string>("");
  /** Ignore stale site-building responses when the user changes Location quickly. */
  const buildingsReqSeq = useRef(0);
  const [incomingPrefill, setIncomingPrefill] = useState<IncomingRegistrationPrefill | null>(
    null,
  );
  const [form, setForm] = useState({
    asset_name: "",
    serial_number: "",
    asset_category_id: "",
    asset_type_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: "0",
    currency_code: "INR",
    make: "",
    model: "",
    processor: "",
    generation: "",
    ram: "",
    storage: "",
    location_id: "",
    building_id: "",
    charger_available: "" as "" | "yes" | "no",
    charger_code: "",
  });

  const fromIncoming = Boolean(incomingUnitId);
  const typeOptions = useMemo(() => {
    // Prefer this asset/session company's catalog (API seeds missing defaults).
    // Fall back to unique names from the full list so the dropdown never shows
    // only a single imported type like "laptop".
    const scoped = editCompanyId
      ? assetTypes.filter((t) => t.company_id === editCompanyId)
      : [];
    let base = scoped.length > 0 ? scoped : assetTypes;
    if (base.length < 2 && assetTypes.length > base.length) {
      const seen = new Set(base.map((t) => t.name.trim().toLowerCase()));
      const extras: ItAssetType[] = [];
      for (const t of assetTypes) {
        const key = t.name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        extras.push(t);
      }
      base = [...base, ...extras];
    }
    if (
      form.asset_type_id &&
      !base.some((t) => t.id === form.asset_type_id)
    ) {
      const orphan =
        assetTypes.find((t) => t.id === form.asset_type_id) ??
        ({
          id: form.asset_type_id,
          name: form.asset_name || "Current type",
          active: true,
          requires_hardware_config: false,
          eligible_as_component: false,
          description: null,
          company_id: editCompanyId || "",
          version: 1,
        } satisfies ItAssetType);
      return [orphan, ...base];
    }
    return base;
  }, [assetTypes, editCompanyId, form.asset_type_id, form.asset_name]);
  const selectedType = useMemo(
    () => typeOptions.find((t) => t.id === form.asset_type_id) ?? null,
    [typeOptions, form.asset_type_id],
  );
  const requiresHardware = selectedType?.requires_hardware_config === true;
  const showGeneration = requiresHardware && isIntelProcessor(form.processor);
  // Show every location returned by the API (org-scoped). Do not hide other
  // companies' sites — users reported empty/partial Location dropdowns.
  const locationOptions = siteLocations;
  const buildingOptions = useMemo(() => {
    const locId = String(form.location_id || "");
    if (!locId || buildingsForLocationId !== locId) return [] as SiteBuilding[];
    // API already filters by location_id; keep a string-safe client guard.
    return siteBuildings.filter((b) => String(b.location_id) === locId);
  }, [siteBuildings, form.location_id, buildingsForLocationId]);

  const loadBuildingsForLocation = useCallback(
    async (locationId: string, opts?: { autoSelectSingle?: boolean }) => {
      const seq = ++buildingsReqSeq.current;
      if (!locationId) {
        if (seq === buildingsReqSeq.current) {
          setSiteBuildings([]);
          setBuildingsForLocationId("");
        }
        return [] as SiteBuilding[];
      }
      try {
        const rows = await listSiteBuildings(locationId);
        if (seq !== buildingsReqSeq.current) return rows;
        setSiteBuildings(rows);
        setBuildingsForLocationId(locationId);
        if (opts?.autoSelectSingle && rows.length === 1) {
          const onlyId = rows[0]!.id;
          setForm((f) =>
            f.location_id === locationId ? { ...f, building_id: onlyId } : f,
          );
        }
        return rows;
      } catch {
        if (seq === buildingsReqSeq.current) {
          setSiteBuildings([]);
          setBuildingsForLocationId(locationId);
        }
        return [] as SiteBuilding[];
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      if (!isAuthenticated()) return;
      try {
        const sessionCompanyId = getStoredOrgContext()?.companyId || undefined;
        const categoryPayload = await assetCategoryService.search({
          page: 1,
          page_size: 200,
          status: "active",
          company_id: sessionCompanyId,
        });
        const active = filterActiveCategories(categoryPayload.items);

        if (assetId) {
          const row = await assetRegisterService.get(assetId);
          const assetCompanyId = String(row.company_id ?? "") || null;
          setEditCompanyId(assetCompanyId);
          // Seed/load types for the asset company so Asset Name shows the full catalog
          // (not only a single imported "laptop" row). Also load org-wide as fallback.
          const [companyTypes, allTypes, locs, comps, locationRows] = await Promise.all([
            listItAssetTypes({
              active: true,
              company_id: assetCompanyId || undefined,
            }).catch(() => [] as ItAssetType[]),
            listItAssetTypes({ active: true }).catch(() => [] as ItAssetType[]),
            listSiteLocations().catch(() => [] as SiteLocation[]),
            componentService
              .search({
                asset_id: assetId,
                component_type: "CHARGER",
                status: "active",
                page: 1,
                page_size: 20,
              })
              .catch(() => ({ items: [] as Array<Record<string, unknown>> })),
            assetLocationService
              .search({
                asset_id: assetId,
                is_current: true,
                status: "active",
                page: 1,
                page_size: 5,
              })
              .catch(() => ({ items: [] as Array<{ location_id?: string | null; building_id?: string | null }> })),
          ]);
          const typeById = new Map<string, ItAssetType>();
          for (const t of [...companyTypes, ...allTypes]) {
            typeById.set(t.id, t);
          }
          const types = [...typeById.values()];
          setAssetTypes(types);
          setSiteLocations(locs);
          const charger = comps.items.find(
            (c) => String(c.component_type ?? "").toUpperCase() === "CHARGER",
          );
          const currentLoc = locationRows.items[0];
          const labelHint = String(
            currentLoc?.location_label ?? row.current_location_label ?? "",
          );
          let locationId = resolveActiveLocationId(
            locs,
            String(row.location_id ?? currentLoc?.location_id ?? ""),
            labelHint,
            assetCompanyId,
          );
          // Prefer the site location that belongs to the asset company (duplicate city names).
          if (locationId && assetCompanyId) {
            const scoped = locs.find(
              (l) => l.id === locationId && l.company_id === assetCompanyId,
            );
            if (!scoped) {
              const byName = locs.find(
                (l) =>
                  l.company_id === assetCompanyId &&
                  normalizeLocName(l.name) ===
                  normalizeLocName(cityFromLocationLabel(labelHint) || labelHint),
              );
              if (byName) locationId = byName.id;
            }
          }
          let buildingId = String(
            row.building_id ?? currentLoc?.building_id ?? "",
          );
          if (locationId) {
            let buildingsForLoc = await loadBuildingsForLocation(locationId);
            // Soft-deleted masters leave empty Address — try same city under asset company / others.
            if (buildingsForLoc.length === 0 && labelHint) {
              const city = normalizeLocName(cityFromLocationLabel(labelHint));
              const alternates = locs.filter(
                (l) =>
                  l.id !== locationId &&
                  normalizeLocName(l.name) === city &&
                  (!assetCompanyId || l.company_id === assetCompanyId),
              );
              const broader =
                alternates.length > 0
                  ? alternates
                  : locs.filter(
                    (l) =>
                      l.id !== locationId && normalizeLocName(l.name) === city,
                  );
              for (const alt of broader) {
                const rows = await loadBuildingsForLocation(alt.id);
                if (rows.length > 0) {
                  locationId = alt.id;
                  buildingsForLoc = rows;
                  buildingId = "";
                  break;
                }
              }
            }
            // Excel import often stores location without building — default the only address.
            if (
              buildingId &&
              !buildingsForLoc.some((b) => String(b.id) === buildingId)
            ) {
              buildingId = "";
            }
            if (!buildingId) {
              const forLoc = buildingsForLoc.filter(
                (b) => String(b.location_id) === locationId,
              );
              if (forLoc.length === 1) {
                buildingId = forLoc[0]!.id;
              }
            }
          } else {
            buildingsReqSeq.current += 1;
            setSiteBuildings([]);
            setBuildingsForLocationId("");
          }
          setInitialLocationId(locationId);
          setInitialBuildingId(buildingId);
          const hardware = parseConfigurationString(
            typeof row.configuration === "string" ? row.configuration : null,
          );
          setEditVersion(typeof row.version === "number" ? row.version : null);
          const companyCatalog = types.filter(
            (t) => !assetCompanyId || t.company_id === assetCompanyId,
          );
          const editTypeId = String(row.asset_type_id ?? "");
          let editTypeName =
            types.find((t) => t.id === editTypeId)?.name ?? String(row.asset_name ?? "");
          // Resolve type by name within asset company when id missing / wrong company catalog.
          let resolvedTypeId = editTypeId;
          if (
            !resolvedTypeId ||
            !companyCatalog.some((t) => t.id === resolvedTypeId)
          ) {
            const byName = companyCatalog.find(
              (t) =>
                normalizeLocName(t.name) ===
                normalizeLocName(String(row.asset_name ?? editTypeName)),
            );
            if (byName) {
              resolvedTypeId = byName.id;
              editTypeName = byName.name;
            }
          }
          setForm((f) => ({
            ...f,
            asset_name: editTypeName,
            serial_number: String(row.serial_number ?? ""),
            asset_category_id: String(row.asset_category_id ?? f.asset_category_id),
            asset_type_id: resolvedTypeId || f.asset_type_id,
            purchase_date: String(row.purchase_date ?? f.purchase_date).slice(0, 10),
            purchase_cost:
              row.purchase_cost != null ? String(row.purchase_cost) : f.purchase_cost,
            currency_code: String(row.currency_code ?? f.currency_code),
            make: String(row.make ?? ""),
            model: String(row.model ?? ""),
            processor: hardware.processor,
            generation: hardware.generation,
            ram: hardware.ram,
            storage: hardware.storage,
            location_id: locationId,
            building_id: buildingId,
            charger_available: charger ? "yes" : "no",
            // Prefer serial (unique charger id). component_code is often auto
            // CHARGER-0001 per asset and must not be written back as serial.
            charger_code: charger
              ? String(charger.serial_number || charger.component_code || "")
              : "",
          }));
          return;
        }

        setEditCompanyId(sessionCompanyId || null);
        const [sessionTypes, allTypes, locs] = await Promise.all([
          listItAssetTypes({
            active: true,
            company_id: sessionCompanyId,
          }).catch(() => [] as ItAssetType[]),
          listItAssetTypes({ active: true }).catch(() => [] as ItAssetType[]),
          listSiteLocations().catch(() => [] as SiteLocation[]),
        ]);
        const typeById = new Map<string, ItAssetType>();
        for (const t of [...sessionTypes, ...allTypes]) {
          typeById.set(t.id, t);
        }
        const resolvedTypes = [...typeById.values()];
        setAssetTypes(resolvedTypes);
        setSiteLocations(locs);
        buildingsReqSeq.current += 1;
        setSiteBuildings([]);
        setBuildingsForLocationId("");

        let prefill: IncomingRegistrationPrefill | null = null;
        if (incomingUnitId) {
          prefill = await assetRegistrationQueueService.prefillFromIncoming(
            incomingUnitId,
            incomingLineId,
          );
          setIncomingPrefill(prefill);
        }

        setForm((f) => {
          let next = f;
          if (prefill) {
            next = {
              ...next,
              asset_name: prefill.asset_name || next.asset_name,
              serial_number: prefill.serial_number || "",
              asset_category_id: prefill.asset_category_id || next.asset_category_id,
              purchase_date:
                (prefill.purchase_date || "").slice(0, 10) || next.purchase_date,
              purchase_cost:
                prefill.purchase_cost != null ? String(prefill.purchase_cost) : next.purchase_cost,
              currency_code: prefill.currency_code || next.currency_code,
            };
            if (prefill.asset_type_id) {
              next = { ...next, asset_type_id: prefill.asset_type_id };
            } else if (prefill.asset_type) {
              const match = resolvedTypes.find(
                (t) => t.name.toLowerCase() === String(prefill.asset_type).toLowerCase(),
              );
              if (match) next = { ...next, asset_type_id: match.id };
            }
          }
          if (!next.asset_category_id && active.length > 0) {
            next = { ...next, asset_category_id: active[0]!.id };
          }
          if (!next.asset_type_id && resolvedTypes.length > 0) {
            next = {
              ...next,
              asset_type_id: resolvedTypes[0]!.id,
              asset_name: resolvedTypes[0]!.name,
            };
          } else if (next.asset_type_id) {
            const typeName = resolvedTypes.find((t) => t.id === next.asset_type_id)?.name;
            if (typeName) next = { ...next, asset_name: typeName };
          }
          return next;
        });
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : isEdit
              ? "Failed to load asset for editing."
              : "Failed to load registration defaults (categories / location / types).",
        );
      }
    })();
  }, [incomingUnitId, incomingLineId, assetId, isEdit, loadBuildingsForLocation]);

  const onAssetType = useCallback(
    (assetTypeId: string) => {
      const typeName = assetTypes.find((t) => t.id === assetTypeId)?.name ?? "";
      setFieldErrors((e) => ({ ...e, asset_type_id: undefined, asset_name: undefined }));
      setForm((f) => ({
        ...f,
        asset_type_id: assetTypeId,
        asset_name: typeName,
        processor: "",
        generation: "",
        ram: "",
        storage: "",
      }));
    },
    [assetTypes],
  );

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.asset_type_id) {
      next.asset_type_id = "Asset name is required.";
    }
    if (!form.asset_category_id) {
      next.asset_category_id = "No active asset category is available. Contact an administrator.";
    }
    if (!form.location_id) next.location_id = "Location is required.";
    // Imported assets often have location without building. On edit, require Address
    // only when the location changes or there was never a saved location.
    const locationChanged = isEdit && form.location_id !== initialLocationId;
    const hadSavedLocation = Boolean(initialLocationId);
    if (!form.building_id && (!isEdit || locationChanged || !hadSavedLocation)) {
      next.building_id = "Address is required.";
    }

    if (!form.charger_available) {
      next.charger_available = "Select Yes or No for Charger Available.";
    } else if (form.charger_available === "yes" && !form.charger_code.trim()) {
      next.charger_code = "Charger Code is required when Charger Available is Yes.";
    }

    if (requiresHardware && !isEdit) {
      if (!form.processor.trim()) next.processor = "Processor is required.";
      if (isIntelProcessor(form.processor) && !form.generation.trim()) {
        next.generation = "Generation is required for Intel processors.";
      }
      if (!form.ram.trim()) next.ram = "RAM is required.";
      if (!form.storage.trim()) next.storage = "Storage is required.";
    }

    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please fix the highlighted fields.");
      return false;
    }
    return true;
  }

  async function submit() {
    setError(null);
    setActivationWarning(null);
    const retrying = Boolean(createdAssetId);
    if (!retrying && !validate()) return;

    setSaving(true);
    try {
      const resolvedAssetName =
        assetTypes.find((t) => t.id === form.asset_type_id)?.name?.trim() ||
        form.asset_name.trim();
      if (isEdit && assetId) {
        const configuration = requiresHardware
          ? buildConfigurationString({
            processor: form.processor,
            generation: showGeneration ? form.generation : "",
            ram: form.ram,
            storage: form.storage,
          })
          : undefined;
        const updateBody: Record<string, unknown> = {
          asset_name: resolvedAssetName,
          serial_number: form.serial_number.trim() || null,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          charger_available: form.charger_available === "yes",
          charger_code:
            form.charger_available === "yes" ? form.charger_code.trim() : null,
        };
        if (form.asset_type_id) {
          updateBody.asset_type_id = form.asset_type_id;
        }
        // Only re-persist site location when both ids are set, or when location
        // alone changed (import rows may have location without building).
        const locationUnchanged =
          form.location_id === initialLocationId &&
          form.building_id === initialBuildingId;
        if (!locationUnchanged) {
          if (form.location_id && form.building_id) {
            updateBody.location_id = form.location_id;
            updateBody.building_id = form.building_id;
          } else if (form.location_id && form.location_id !== initialLocationId) {
            updateBody.location_id = form.location_id;
          }
        }
        if (configuration !== undefined) {
          updateBody.configuration = configuration;
        } else if (form.processor || form.ram || form.storage) {
          updateBody.configuration = buildConfigurationString({
            processor: form.processor,
            generation: form.generation,
            ram: form.ram,
            storage: form.storage,
          });
        }
        if (editVersion != null) updateBody.version = editVersion;
        await assetRegisterService.update(assetId, updateBody);
        router.push("/assets/assets");
        return;
      }

      let id = createdAssetId;
      if (!id) {
        const configuration = requiresHardware
          ? buildConfigurationString({
            processor: form.processor,
            generation: showGeneration ? form.generation : "",
            ram: form.ram,
            storage: form.storage,
          })
          : undefined;
        // branch_id omitted — API resolves from the authenticated user's org scope / session.
        const createBody: Record<string, unknown> = {
          asset_category_id: form.asset_category_id,
          asset_name: resolvedAssetName,
          asset_type_id: form.asset_type_id,
          serial_number: form.serial_number.trim() || undefined,
          purchase_date: form.purchase_date,
          purchase_cost: Number(form.purchase_cost || 0),
          currency_code: form.currency_code || "INR",
          make: form.make.trim() || undefined,
          model: form.model.trim() || undefined,
          configuration,
          location_id: form.location_id,
          building_id: form.building_id,
          charger_available: form.charger_available === "yes",
        };
        if (form.charger_available === "yes") {
          createBody.charger_code = form.charger_code.trim();
        }
        if (fromIncoming && incomingUnitId) {
          createBody.incoming_unit_id = incomingUnitId;
          if (incomingLineId) createBody.incoming_line_id = incomingLineId;
          if (incomingPrefill?.branch_id) createBody.branch_id = incomingPrefill.branch_id;
          if (incomingPrefill?.grn_id) createBody.grn_id = incomingPrefill.grn_id;
          if (incomingPrefill?.purchase_order_id) {
            createBody.purchase_order_id = incomingPrefill.purchase_order_id;
          }
          if (incomingPrefill?.product_id) createBody.product_id = incomingPrefill.product_id;
          if (incomingPrefill?.supplier_vendor_id) {
            createBody.supplier_vendor_id = incomingPrefill.supplier_vendor_id;
          }
          if (incomingPrefill?.quality_inspection_id) {
            createBody.quality_inspection_id = incomingPrefill.quality_inspection_id;
          }
        }
        const created = await assetRegisterService.create(createBody);
        id = String(created.id);
        setCreatedAssetId(id);
        const qr = typeof window !== "undefined" ? buildSelfServiceUrl(id) : undefined;
        if (qr) {
          try {
            await assetRegisterService.update(id, { qr_code: qr });
          } catch {
            // QR is non-critical; registration continues.
          }
        }
      }

      const finishIfReady = (row: {
        status?: unknown;
        operational_status?: unknown;
      }) => {
        const status = String(row.status ?? "").toLowerCase();
        const ops = String(row.operational_status ?? "")
          .toUpperCase()
          .replace(/_/g, " ")
          .trim();
        const lifecycleOk = status === "active" || status === "in_maintenance";
        const opsOk = ops === "" || ops === "READY TO MOVE";
        if (lifecycleOk && opsOk) {
          setActivationWarning(null);
          setError(null);
          router.push("/assets/assets");
          return true;
        }
        return false;
      };

      let row = await assetRegisterService.get(id);
      if (finishIfReady(row)) return;

      let status = String(row.status ?? "").toLowerCase();

      if (status === "draft") {
        try {
          row = await assetRegisterService.action(id, "submit");
          // Gov-off submit activates in one step (mirrors assignment submit).
          if (finishIfReady(row)) return;
          row = await assetRegisterService.get(id);
          if (finishIfReady(row)) return;
        } catch (actErr) {
          try {
            row = await assetRegisterService.get(id);
            if (finishIfReady(row)) return;
          } catch {
            /* keep error path */
          }
          const msg =
            actErr instanceof ApiClientError
              ? actErr.message
              : "Submission failed.";
          setError(`Asset created, but submission failed. ${msg}`);
          setActivationWarning(
            "The asset exists as a draft. Retry submit/approve, or open the asset to continue.",
          );
          return;
        }
      }

      status = String(row.status ?? "").toLowerCase();
      if (status === "submitted" || status === "approved") {
        try {
          row = await assetRegisterService.action(id, "approve");
          if (finishIfReady(row)) return;
          row = await assetRegisterService.get(id);
          if (finishIfReady(row)) return;
        } catch (actErr) {
          try {
            row = await assetRegisterService.get(id);
            if (finishIfReady(row)) return;
          } catch {
            /* keep prior status */
          }
          const msg =
            actErr instanceof ApiClientError
              ? actErr.message
              : "Approval failed.";
          if (/already|status has changed|cannot approve|not submitted/i.test(msg)) {
            setError(
              `Asset status has changed. Refreshing the latest status. ${msg}`,
            );
          } else {
            setError(`Asset submitted, but approval failed. ${msg}`);
          }
          setActivationWarning(
            "The asset exists but is not fully activated. Retry approval, or open the asset.",
          );
          return;
        }
      }

      try {
        row = await assetRegisterService.get(id);
      } catch {
        /* use last row */
      }
      if (finishIfReady(row)) return;

      status = String(row.status ?? "").toLowerCase();
      const ops = String(row.operational_status ?? "").toUpperCase();
      if (status === "active" || status === "in_maintenance") {
        setActivationWarning(
          `Asset approved (lifecycle: ${status}) but operational status is ${ops || "unknown"}. Open the asset to verify.`,
        );
        return;
      }

      setError(
        `Activation incomplete. Current status: ${status || "unknown"}. Retry activation without creating a new asset.`,
      );
      setActivationWarning(
        "Asset created, but activation is incomplete. Use Retry activation or open the asset.",
      );
    } catch (err) {
      if (createdAssetId) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Activation failed. The asset may already exist — retry without creating again.",
        );
      } else {
        setError(err instanceof ApiClientError ? err.message : "Failed to create asset");
      }
    } finally {
      setSaving(false);
    }
  }

  const inventoryHref = "/assets/assets";

  return (
    <AssetsPremiumPage className="space-y-4" testId={isEdit ? "asset-edit-form" : "asset-add-form"}>
      <PageHeader
        title={isEdit ? "Edit Asset" : "Add Asset"}
        actions={
          !fromIncoming && !isEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2 transition-colors duration-200"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" aria-hidden />
              Import From Excel
            </Button>
          ) : undefined
        }
      />

      <ItAssetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        assetTypes={assetTypes}
        siteLocations={siteLocations}
        fallbackBranchId={form.branch_id || undefined}
        companyId={
          siteLocations.find((l) => l.company_id)?.company_id ||
          getStoredOrgContext()?.companyId
        }
        currencyCode={form.currency_code}
        onImported={() => {
          markInventoryStale({ reason: "import" });
        }}
      />

      {error ? (
        <p
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {activationWarning ? (
        <div
          role="status"
          className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950"
        >
          <p>{activationWarning}</p>
          {createdAssetId ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="cursor-pointer" asChild>
                <Link href={`/assets/assets/${createdAssetId}`}>View asset</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={saving}
                onClick={() => void submit()}
              >
                Retry activation
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {incomingPrefill ? (
        <Card className="rounded-xl border-border/70 bg-muted/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Incoming / QC source
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                GRN
              </div>
              <div className="font-medium">{incomingPrefill.grn_document_number}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                PO
              </div>
              <div className="font-medium">{incomingPrefill.po_document_number ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                QC
              </div>
              <div className="font-medium">{incomingPrefill.qc_status}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Incoming Unit ID
              </div>
              <div className="font-mono text-xs">{incomingPrefill.incoming_unit_id}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <FormSection id="add-asset-basic" title="Basic" icon={Package}>
          <Field label="Asset Name *" error={fieldErrors.asset_type_id ?? fieldErrors.asset_name}>
            <Select
              value={form.asset_type_id || undefined}
              onValueChange={onAssetType}
            >
              <SelectTrigger
                id="asset_name"
                className="cursor-pointer transition-colors duration-200"
                aria-label="Asset Name"
                aria-invalid={Boolean(fieldErrors.asset_type_id ?? fieldErrors.asset_name)}
              >
                <SelectValue placeholder="Select Asset Name" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Serial Number" htmlFor="serial_number">
            <Input
              id="serial_number"
              value={form.serial_number}
              className="transition-colors duration-200"
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
            />
          </Field>
          {fieldErrors.asset_category_id ? (
            <p className="text-sm text-destructive sm:col-span-2" role="alert">
              {fieldErrors.asset_category_id}
            </p>
          ) : null}
          {typeOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              No active asset types. An IT admin must create types under Configuration → Asset
              Types.
            </p>
          ) : null}
        </FormSection>

        <FormSection
          id="add-asset-it"
          title="IT Information"
          icon={Cpu}
          columns={requiresHardware ? "three" : "two"}
        >
          <Field label="Make" htmlFor="make">
            <Input
              id="make"
              value={form.make}
              placeholder="e.g. Dell"
              className="transition-colors duration-200"
              onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
            />
          </Field>
          <Field label="Model" htmlFor="model">
            <Input
              id="model"
              value={form.model}
              placeholder="e.g. Latitude 5440"
              className="transition-colors duration-200"
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </Field>
          {requiresHardware ? (
            <Field label="Processor *" error={fieldErrors.processor}>
              <Select
                value={form.processor}
                onValueChange={(v) => {
                  setFieldErrors((err) => ({
                    ...err,
                    processor: undefined,
                    generation: undefined,
                  }));
                  setForm((f) => ({
                    ...f,
                    processor: v,
                    generation: isIntelProcessor(v) ? f.generation : "",
                  }));
                }}
              >
                <SelectTrigger
                  className="cursor-pointer transition-colors duration-200"
                  aria-label="Processor"
                >
                  <SelectValue placeholder="Select Processor" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESSOR_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="cursor-pointer">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {showGeneration ? (
            <Field label="Generation *" error={fieldErrors.generation}>
              <Select
                value={form.generation}
                onValueChange={(v) => {
                  setFieldErrors((err) => ({ ...err, generation: undefined }));
                  setForm((f) => ({ ...f, generation: v }));
                }}
              >
                <SelectTrigger
                  className="cursor-pointer transition-colors duration-200"
                  aria-label="Generation"
                >
                  <SelectValue placeholder="Select Generation" />
                </SelectTrigger>
                <SelectContent>
                  {INTEL_GENERATION_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g} className="cursor-pointer">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {requiresHardware ? (
            <Field label="RAM *" error={fieldErrors.ram}>
              <Select
                value={form.ram}
                onValueChange={(v) => {
                  setFieldErrors((err) => ({ ...err, ram: undefined }));
                  setForm((f) => ({ ...f, ram: v }));
                }}
              >
                <SelectTrigger
                  className="cursor-pointer transition-colors duration-200"
                  aria-label="RAM"
                >
                  <SelectValue placeholder="Select RAM" />
                </SelectTrigger>
                <SelectContent>
                  {RAM_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r} className="cursor-pointer">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {requiresHardware ? (
            <Field label="Storage *" error={fieldErrors.storage}>
              <Select
                value={form.storage}
                onValueChange={(v) => {
                  setFieldErrors((err) => ({ ...err, storage: undefined }));
                  setForm((f) => ({ ...f, storage: v }));
                }}
              >
                <SelectTrigger
                  className="cursor-pointer transition-colors duration-200"
                  aria-label="Storage"
                >
                  <SelectValue placeholder="Select Storage" />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </FormSection>

        <FormSection id="add-asset-location" title="Location" icon={MapPin}>
          <Field label="Location *" error={fieldErrors.location_id}>
            <Select
              value={form.location_id || undefined}
              onValueChange={(v) => {
                setFieldErrors((err) => ({
                  ...err,
                  location_id: undefined,
                  building_id: undefined,
                }));
                setForm((f) => ({ ...f, location_id: v, building_id: "" }));
                setSiteBuildings([]);
                setBuildingsForLocationId("");
                void loadBuildingsForLocation(v, { autoSelectSingle: true });
              }}
            >
              <SelectTrigger
                className="cursor-pointer transition-colors duration-200"
                aria-label="Location"
              >
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((c) => {
                  const dupName =
                    locationOptions.filter(
                      (o) => normalizeLocName(o.name) === normalizeLocName(c.name),
                    ).length > 1;
                  return (
                    <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                      {c.name}
                      {c.is_head_office ? " (Head Office)" : ""}
                      {dupName ? ` · ${c.company_id.slice(0, 8)}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={isEdit && initialLocationId && !initialBuildingId ? "Address" : "Address *"}
            error={fieldErrors.building_id}
          >
            <Select
              value={form.building_id || undefined}
              onValueChange={(v) => {
                setFieldErrors((err) => ({ ...err, building_id: undefined }));
                setForm((f) => ({ ...f, building_id: v }));
              }}
              disabled={!form.location_id}
            >
              <SelectTrigger
                className="cursor-pointer transition-colors duration-200"
                aria-label="Address"
              >
                <SelectValue
                  placeholder={form.location_id ? "Select Address" : "Select Location First"}
                />
              </SelectTrigger>
              <SelectContent>
                {buildingOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No address
                  </SelectItem>
                ) : (
                  buildingOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                      {b.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>

        <FormSection
          id="add-asset-charger"
          title="Charger"
          icon={BatteryCharging}
          testId="asset-charger-section"
        >
          <Field label="Charger Available *" error={fieldErrors.charger_available}>
            <Select
              value={form.charger_available || undefined}
              onValueChange={(v) => {
                const next = v === "yes" || v === "no" ? v : "";
                setFieldErrors((err) => ({
                  ...err,
                  charger_available: undefined,
                  charger_code: undefined,
                }));
                setForm((f) => ({
                  ...f,
                  charger_available: next,
                  charger_code: next === "yes" ? f.charger_code : "",
                }));
              }}
            >
              <SelectTrigger
                className="cursor-pointer transition-colors duration-200"
                aria-label="Charger Available"
                data-testid="charger-available-select"
              >
                <SelectValue placeholder="Select Yes or No" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes" className="cursor-pointer">
                  Yes
                </SelectItem>
                <SelectItem value="no" className="cursor-pointer">
                  No
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.charger_available === "yes" ? (
            <Field label="Charger Code *" error={fieldErrors.charger_code} htmlFor="charger_code">
              <Input
                id="charger_code"
                value={form.charger_code}
                placeholder="Enter charger code"
                aria-invalid={Boolean(fieldErrors.charger_code)}
                data-testid="charger-code-input"
                className="transition-colors duration-200"
                onChange={(e) => {
                  setFieldErrors((err) => ({ ...err, charger_code: undefined }));
                  setForm((f) => ({ ...f, charger_code: e.target.value }));
                }}
              />
            </Field>
          ) : null}
        </FormSection>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          asChild
          className="cursor-pointer transition-colors duration-200"
        >
          <Link href={inventoryHref}>Cancel</Link>
        </Button>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className={cn(ASSETS_ACCENT_BTN, "cursor-pointer transition-colors duration-200")}
          data-testid={isEdit ? "asset-edit-save" : "asset-add-save"}
        >
          {saving ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
          {isEdit ? "Save Changes" : createdAssetId ? "Retry activation" : "Add Asset"}
        </Button>
      </div>
    </AssetsPremiumPage>
  );
}

function Field({
  label,
  children,
  error,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use AssetAddForm */
export const AssetAddWizard = AssetAddForm;
