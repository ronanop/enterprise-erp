"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
  getItConfigRule,
  isIntelProcessor,
} from "@/config/asset-it-config-rules";
import { ASSET_PRD_TYPES, getPrdType } from "@/config/asset-prd-types";
import {
  ASSET_SITE_CATALOG,
  buildingsForCity,
  composeLocationLabel,
} from "@/config/asset-site-catalog";
import { isAuthenticated } from "@/lib/auth";
import { listBranchOptions, type OrgOption } from "@/lib/org-options";
import { buildSelfServiceUrl } from "@/services/assets-service";
import {
  assetCategoryService,
  assetRegisterService,
  assetRegistrationQueueService,
  filterActiveCategories,
  type AssetCategoryRow,
  type IncomingRegistrationPrefill,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

type FieldErrors = Partial<
  Record<
    | "asset_name"
    | "asset_category_id"
    | "prd_type_id"
    | "make"
    | "model"
    | "processor"
    | "generation"
    | "ram"
    | "storage"
    | "city_id"
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
  const [categories, setCategories] = useState<AssetCategoryRow[]>([]);
  const [branches, setBranches] = useState<OrgOption[]>([]);
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
    prd_type_id: "",
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
    city_id: "",
    building_id: "",
  });

  const fromIncoming = Boolean(incomingUnitId);
  const itRule = getItConfigRule(form.prd_type_id);
  const showGeneration = itRule.showProcessor && isIntelProcessor(form.processor);
  const buildingOptions = useMemo(
    () => buildingsForCity(form.city_id),
    [form.city_id],
  );

  useEffect(() => {
    void (async () => {
      if (!isAuthenticated()) return;
      try {
        const [categoryPayload, branchOptions] = await Promise.all([
          assetCategoryService.search({
            page: 1,
            page_size: 200,
            status: "active",
          }),
          listBranchOptions(),
        ]);
        const active = filterActiveCategories(categoryPayload.items);
        setCategories(active);
        setBranches(branchOptions);

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
            if (prefill.asset_type) {
              const match = ASSET_PRD_TYPES.find((t) => t.apiAssetType === prefill.asset_type);
              if (match) next = { ...next, prd_type_id: match.id };
            }
          }
          if (!next.asset_category_id && active.length === 1) {
            next = { ...next, asset_category_id: active[0].id };
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
            : "Failed to load categories, branches, or incoming prefill.",
        );
      }
    })();
  }, [incomingUnitId, incomingLineId]);

  const onPrdType = useCallback((prdTypeId: string) => {
    setFieldErrors((e) => ({ ...e, prd_type_id: undefined }));
    setForm((f) => ({
      ...f,
      prd_type_id: prdTypeId,
      // Clear hardware when switching types so stale Laptop values don't leak
      processor: "",
      generation: "",
      ram: "",
      storage: "",
    }));
  }, []);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.asset_name.trim()) next.asset_name = "Asset name is required.";
    if (!form.asset_category_id) next.asset_category_id = "Category is required.";
    if (!form.prd_type_id) next.prd_type_id = "Asset type is required.";
    if (!form.branch_id) next.branch_id = "Branch is required.";
    if (!form.city_id) next.city_id = "Location is required.";
    if (!form.building_id) next.building_id = "Building is required.";

    const rule = getItConfigRule(form.prd_type_id);
    if (rule.requireHardware) {
      if (rule.showProcessor && !form.processor.trim()) {
        next.processor = "Processor is required.";
      }
      if (rule.showProcessor && isIntelProcessor(form.processor) && !form.generation.trim()) {
        next.generation = "Generation is required for Intel processors.";
      }
      if (rule.showRam && !form.ram.trim()) next.ram = "RAM is required.";
      if (rule.showStorage && !form.storage.trim()) next.storage = "Storage is required.";
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
        const prd = getPrdType(form.prd_type_id);
        const configuration = buildConfigurationString({
          processor: form.processor,
          generation: showGeneration ? form.generation : "",
          ram: form.ram,
          storage: form.storage,
        });
        const locationLabel = composeLocationLabel(form.city_id, form.building_id);

        const createBody: Record<string, unknown> = {
          branch_id: form.branch_id,
          asset_category_id: form.asset_category_id,
          asset_name: form.asset_name.trim(),
          asset_type: prd?.apiAssetType ?? "fixed",
          serial_number: form.serial_number.trim() || undefined,
          purchase_date: form.purchase_date,
          purchase_cost: Number(form.purchase_cost || 0),
          currency_code: form.currency_code || "INR",
          make: form.make.trim() || undefined,
          model: form.model.trim() || undefined,
          configuration,
          location_label: locationLabel,
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
        description="Register a new IT asset"
        actions={
          <Button variant="outline" size="sm" asChild className="cursor-pointer">
            <Link href="/assets/assets">Cancel</Link>
          </Button>
        }
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
          <Field
            label="Category *"
            error={fieldErrors.asset_category_id}
          >
            <Select
              value={form.asset_category_id}
              onValueChange={(v) => {
                setFieldErrors((err) => ({ ...err, asset_category_id: undefined }));
                setForm((f) => ({ ...f, asset_category_id: v }));
              }}
            >
              <SelectTrigger className="cursor-pointer" aria-label="Category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No active categories
                  </SelectItem>
                ) : (
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.category_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Asset Type *" error={fieldErrors.prd_type_id}>
            <Select value={form.prd_type_id} onValueChange={onPrdType}>
              <SelectTrigger className="cursor-pointer" aria-label="Asset Type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_PRD_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.typeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
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
          {itRule.showProcessor ? (
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
          {itRule.showRam ? (
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
          {itRule.showStorage ? (
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
        {!itRule.showProcessor ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Hardware configuration fields apply to Laptop, Desktop, and Mobile Device types.
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
          <Field label="Location *" error={fieldErrors.city_id}>
            <Select
              value={form.city_id}
              onValueChange={(v) => {
                setFieldErrors((err) => ({
                  ...err,
                  city_id: undefined,
                  building_id: undefined,
                }));
                setForm((f) => ({ ...f, city_id: v, building_id: "" }));
              }}
            >
              <SelectTrigger className="cursor-pointer" aria-label="Location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_SITE_CATALOG.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
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
              disabled={!form.city_id}
            >
              <SelectTrigger className="cursor-pointer" aria-label="Building">
                <SelectValue
                  placeholder={form.city_id ? "Select building" : "Select location first"}
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
                      {b.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Location is saved as the asset&apos;s current location label on create.
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
