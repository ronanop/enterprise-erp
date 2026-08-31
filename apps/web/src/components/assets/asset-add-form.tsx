"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

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
} from "@/config/asset-hardware-options";
import { isAuthenticated } from "@/lib/auth";
import { listBranchOptions, type OrgOption } from "@/lib/org-options";
import { buildSelfServiceUrl } from "@/services/assets-service";
import {
  assetCategoryService,
  assetRegisterService,
  assetRegistrationQueueService,
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
    | "branch_id",
    string
  >
>;

type AssetAddFormProps = {
  incomingUnitId?: string;
  incomingLineId?: string;
};

export function AssetAddForm({
  incomingUnitId,
  incomingLineId,
}: AssetAddFormProps = {}) {
  const router = useRouter();
  const [branches, setBranches] = useState<OrgOption[]>([]);
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [siteBuildings, setSiteBuildings] = useState<SiteBuilding[]>([]);
  const [assetTypes, setAssetTypes] = useState<ItAssetType[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [activationWarning, setActivationWarning] = useState<string | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [incomingPrefill, setIncomingPrefill] = useState<IncomingRegistrationPrefill | null>(
    null,
  );
  const [form, setForm] = useState({
    asset_name: "",
    serial_number: "",
    asset_category_id: "",
    asset_type_id: "",
    branch_id: "",
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
  });

  const fromIncoming = Boolean(incomingUnitId);
  const selectedType = useMemo(
    () => assetTypes.find((t) => t.id === form.asset_type_id) ?? null,
    [assetTypes, form.asset_type_id],
  );
  const requiresHardware = selectedType?.requires_hardware_config === true;
  const showGeneration = requiresHardware && isIntelProcessor(form.processor);
  const buildingOptions = useMemo(
    () => siteBuildings.filter((b) => b.location_id === form.location_id),
    [siteBuildings, form.location_id],
  );

  useEffect(() => {
    void (async () => {
      if (!isAuthenticated()) return;
      try {
        const [categoryPayload, branchOptions, locs, types] = await Promise.all([
          assetCategoryService.search({
            page: 1,
            page_size: 200,
            status: "active",
          }),
          listBranchOptions(),
          listSiteLocations().catch(() => [] as SiteLocation[]),
          listItAssetTypes({ active: true }).catch(() => [] as ItAssetType[]),
        ]);
        const active = filterActiveCategories(categoryPayload.items);
        setBranches(branchOptions);
        setSiteLocations(locs);
        setAssetTypes(types);

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
              branch_id: prefill.branch_id || next.branch_id,
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
              const match = types.find(
                (t) => t.name.toLowerCase() === String(prefill.asset_type).toLowerCase(),
              );
              if (match) next = { ...next, asset_type_id: match.id };
            }
          }
          if (!next.asset_category_id && active.length > 0) {
            next = { ...next, asset_category_id: active[0]!.id };
          }
          if (!next.asset_type_id && types.length > 0) {
            next = { ...next, asset_type_id: types[0]!.id };
          }
          if (!next.branch_id && branchOptions.length > 0) {
            next = { ...next, branch_id: branchOptions[0].id };
          }
          return next;
        });
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load registration defaults (branch / location / types).",
        );
      }
    })();
  }, [incomingUnitId, incomingLineId]);

  const onAssetType = useCallback((assetTypeId: string) => {
    setFieldErrors((e) => ({ ...e, asset_type_id: undefined }));
    setForm((f) => ({
      ...f,
      asset_type_id: assetTypeId,
      processor: "",
      generation: "",
      ram: "",
      storage: "",
    }));
  }, []);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.asset_name.trim()) next.asset_name = "Asset name is required.";
    if (!form.asset_category_id) {
      next.asset_category_id = "No active asset category is available. Contact an administrator.";
    }
    if (!form.asset_type_id) next.asset_type_id = "Asset type is required.";
    if (!form.branch_id) next.branch_id = "Branch is required.";
    if (!form.location_id) next.location_id = "Location is required.";
    if (!form.building_id) next.building_id = "Building is required.";

    if (requiresHardware) {
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
        const createBody: Record<string, unknown> = {
          branch_id: form.branch_id,
          asset_category_id: form.asset_category_id,
          asset_name: form.asset_name.trim(),
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
        };
        if (fromIncoming && incomingUnitId) {
          createBody.incoming_unit_id = incomingUnitId;
          if (incomingLineId) createBody.incoming_line_id = incomingLineId;
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

      let row = await assetRegisterService.get(id);
      let status = String(row.status ?? "").toLowerCase();

      if (status === "draft") {
        try {
          row = await assetRegisterService.action(id, "submit");
          status = String(row.status ?? "").toLowerCase();
        } catch (actErr) {
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
          status = String(row.status ?? "").toLowerCase();
        } catch (actErr) {
          try {
            row = await assetRegisterService.get(id);
            status = String(row.status ?? "").toLowerCase();
          } catch {
            /* keep prior status */
          }
          if (status === "active" || status === "in_maintenance") {
            // Success after refresh
          } else {
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
      }

      try {
        row = await assetRegisterService.get(id);
      } catch {
        /* use last row */
      }
      status = String(row.status ?? "").toLowerCase();
      const ops = String(row.operational_status ?? "").toUpperCase();

      if (status === "active" || status === "in_maintenance") {
        if (ops === "READY_TO_MOVE" || ops === "") {
          setActivationWarning(null);
          setError(null);
          router.push(`/assets/assets/${id}`);
          return;
        }
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Add Asset"
        description="Register a new IT asset or import many from Excel"
        actions={
          <div className="flex flex-wrap gap-2">
            {!fromIncoming ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-2 size-4" />
                Import from Excel
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/assets/assets">Cancel</Link>
            </Button>
          </div>
        }
      />

      <ItAssetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        assetTypes={assetTypes}
        siteLocations={siteLocations}
        fallbackBranchId={form.branch_id || undefined}
        currencyCode={form.currency_code}
        onImported={() => {
          /* summary shown in dialog */
        }}
      />

      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {activationWarning ? (
        <div
          role="status"
          className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
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
        <Card className="border-border/80 bg-muted/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Incoming / QC source</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">GRN</div>
              <div className="font-medium">{incomingPrefill.grn_document_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">PO</div>
              <div className="font-medium">{incomingPrefill.po_document_number ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">QC</div>
              <div className="font-medium">{incomingPrefill.qc_status}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Incoming Unit ID</div>
              <div className="font-mono text-xs">{incomingPrefill.incoming_unit_id}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section
        aria-labelledby="add-asset-basic"
        className="rounded-md border border-border/80 bg-card p-3 shadow-sm sm:p-4"
      >
        <h2 id="add-asset-basic" className="mb-3 text-sm font-semibold text-foreground">
          Basic
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Asset Name *"
            error={fieldErrors.asset_name}
            htmlFor="asset_name"
          >
            <Input
              id="asset_name"
              value={form.asset_name}
              aria-invalid={Boolean(fieldErrors.asset_name)}
              onChange={(e) => {
                setFieldErrors((err) => ({ ...err, asset_name: undefined }));
                setForm((f) => ({ ...f, asset_name: e.target.value }));
              }}
            />
          </Field>
          <Field label="Serial Number" htmlFor="serial_number">
            <Input
              id="serial_number"
              value={form.serial_number}
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
            />
          </Field>
          <Field label="Asset Type *" error={fieldErrors.asset_type_id}>
            <Select value={form.asset_type_id} onValueChange={onAssetType}>
              <SelectTrigger className="cursor-pointer" aria-label="Asset Type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {assetTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {fieldErrors.asset_category_id ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {fieldErrors.asset_category_id}
          </p>
        ) : null}
        {assetTypes.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No active asset types. An IT admin must create types under Configuration → Asset Types.
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="add-asset-it"
        className="rounded-md border border-border/80 bg-card p-3 shadow-sm sm:p-4"
      >
        <h2 id="add-asset-it" className="mb-3 text-sm font-semibold text-foreground">
          IT Information
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Manufacturer" htmlFor="make">
            <Input
              id="make"
              value={form.make}
              placeholder="e.g. Dell"
              onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
            />
          </Field>
          <Field label="Model" htmlFor="model">
            <Input
              id="model"
              value={form.model}
              placeholder="e.g. Latitude 5440"
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
                <SelectTrigger className="cursor-pointer" aria-label="Processor">
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESSOR_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
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
                <SelectTrigger className="cursor-pointer" aria-label="Generation">
                  <SelectValue placeholder="Select generation" />
                </SelectTrigger>
                <SelectContent>
                  {INTEL_GENERATION_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>
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
                <SelectTrigger className="cursor-pointer" aria-label="RAM">
                  <SelectValue placeholder="Select RAM" />
                </SelectTrigger>
                <SelectContent>
                  {RAM_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
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
                <SelectTrigger className="cursor-pointer" aria-label="Storage">
                  <SelectValue placeholder="Select storage" />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        {!requiresHardware ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Hardware configuration fields appear when the selected asset type requires them
            (configured under Configuration → Asset Types).
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="add-asset-location"
        className="rounded-md border border-border/80 bg-card p-3 shadow-sm sm:p-4"
      >
        <h2 id="add-asset-location" className="mb-3 text-sm font-semibold text-foreground">
          Location &amp; Registration
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location *" error={fieldErrors.location_id}>
            <Select
              value={form.location_id}
              onValueChange={(v) => {
                setFieldErrors((err) => ({
                  ...err,
                  location_id: undefined,
                  building_id: undefined,
                }));
                setForm((f) => ({ ...f, location_id: v, building_id: "" }));
                void listSiteBuildings(v)
                  .then(setSiteBuildings)
                  .catch(() => setSiteBuildings([]));
              }}
            >
              <SelectTrigger className="cursor-pointer" aria-label="Location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {siteLocations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.is_head_office ? " (Head Office)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Building *" error={fieldErrors.building_id}>
            <Select
              value={form.building_id}
              onValueChange={(v) => {
                setFieldErrors((err) => ({ ...err, building_id: undefined }));
                setForm((f) => ({ ...f, building_id: v }));
              }}
              disabled={!form.location_id}
            >
              <SelectTrigger className="cursor-pointer" aria-label="Building">
                <SelectValue
                  placeholder={form.location_id ? "Select building" : "Select location first"}
                />
              </SelectTrigger>
              <SelectContent>
                {buildingOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No buildings
                  </SelectItem>
                ) : (
                  buildingOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Location and Building come from Configuration → Locations.
        </p>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild className="cursor-pointer">
          <Link href="/assets/assets">Cancel</Link>
        </Button>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="cursor-pointer"
        >
          {saving ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : null}
          {createdAssetId ? "Retry activation" : "Add Asset"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use AssetAddForm */
export const AssetAddWizard = AssetAddForm;
