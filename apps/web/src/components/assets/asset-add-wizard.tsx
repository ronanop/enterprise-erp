"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ASSET_PRD_TYPES } from "@/config/asset-prd-types";
import { isItAssetCategory } from "@/domain/asset-prd";
import { cn } from "@/lib/utils";
import { isAuthenticated } from "@/lib/auth";
import { listBranchOptions, type OrgOption } from "@/lib/org-options";
import {
  assetCategoryService,
  assetDiscoveryService,
  assetLocationService,
  assetRegisterService,
  buildSelfServiceUrl,
  filterActiveCategories,
  type AssetCategoryRow,
} from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

const STEPS = [
  "Basic",
  "Classification",
  "Details",
  "Location",
  "Technical",
  "Review",
] as const;

const API_ASSET_TYPES = ["fixed", "consumable", "digital", "leased"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AssetAddWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<AssetCategoryRow[]>([]);
  const [branches, setBranches] = useState<OrgOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    asset_name: "",
    asset_code: "",
    serial_number: "",
    asset_category_id: "",
    prd_type_id: "",
    asset_type: "fixed" as (typeof API_ASSET_TYPES)[number],
    branch_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: "",
    currency_code: "INR",
    location_label: "",
    building: "",
    floor: "",
    room: "",
    hostname: "",
    mac_address: "",
  });

  const selectedCategory = categories.find((c) => c.id === form.asset_category_id);
  const showTechnical = isItAssetCategory(
    selectedCategory?.category_code,
    selectedCategory?.category_name,
  );

  useEffect(() => {
    void (async () => {
      if (!isAuthenticated()) return;
      const payload = await assetCategoryService.search({
        page: 1,
        page_size: 200,
        status: "active",
      });
      setCategories(filterActiveCategories(payload.items));
      const branchOpts = await listBranchOptions();
      setBranches(branchOpts);
      if (branchOpts.length === 1) {
        setForm((f) => (f.branch_id ? f : { ...f, branch_id: branchOpts[0].id }));
      }
    })();
  }, []);

  const onPrdType = useCallback((prdTypeId: string) => {
    const t = ASSET_PRD_TYPES.find((x) => x.id === prdTypeId);
    setForm((f) => ({
      ...f,
      prd_type_id: prdTypeId,
      asset_type: t?.apiAssetType ?? f.asset_type,
    }));
  }, []);

  async function submit() {
    setError(null);
    if (!form.asset_name.trim()) {
      setError("Asset name is required.");
      return;
    }
    if (!form.asset_category_id) {
      setError("Category is required.");
      return;
    }
    if (!UUID_RE.test(form.branch_id.trim())) {
      setError("Enter a valid branch UUID.");
      return;
    }
    setSaving(true);
    try {
      const created = await assetRegisterService.create({
        branch_id: form.branch_id.trim(),
        asset_category_id: form.asset_category_id,
        asset_name: form.asset_name.trim(),
        serial_number: form.serial_number.trim() || undefined,
        purchase_date: form.purchase_date,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : 0,
        currency_code: form.currency_code,
        asset_type: form.asset_type,
        barcode: form.asset_code.trim() || undefined,
      });
      const id = String(created.id);
      let version = Number(created.version ?? 1);
      const qr = typeof window !== "undefined" ? buildSelfServiceUrl(id) : undefined;
      if (qr) {
        const updated = await assetRegisterService.update(id, { qr_code: qr, version });
        version = Number(updated.version ?? version);
      }
      const locationParts = [
        form.location_label.trim(),
        form.building.trim() && `Bldg ${form.building.trim()}`,
        form.floor.trim() && `Floor ${form.floor.trim()}`,
        form.room.trim() && `Room ${form.room.trim()}`,
      ].filter(Boolean);
      if (locationParts.length) {
        await assetLocationService
          .create({
            asset_id: id,
            branch_id: form.branch_id.trim(),
            location_label: locationParts.join(" · "),
          })
          .catch(() => undefined);
      }
      if (showTechnical && (form.hostname.trim() || form.mac_address.trim())) {
        const raw = [
          form.hostname.trim() ? `HOSTNAME=${form.hostname.trim()}` : "",
          form.mac_address.trim() ? `MAC=${form.mac_address.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        try {
          await assetDiscoveryService.parse(id, { platform: "windows", raw_output: raw });
          const applied = await assetDiscoveryService.apply(id, {
            platform: "windows",
            raw_output: raw,
            version,
            preview_confirmed: true,
          });
          version = applied.version ?? version;
        } catch {
          /* optional IT profile */
        }
      }
      await assetRegisterService.action(id, "submit").catch(() => undefined);
      await assetRegisterService.action(id, "approve").catch(() => undefined);
      router.push(`/assets/assets/${id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Add Asset"
        description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        actions={
          <Link
            href="/assets/assets"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
          >
            Cancel
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <BadgeButton key={label} active={i === step} onClick={() => setStep(i)} label={label} />
        ))}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">
          {step === 0 ? (
            <>
              <Field label="Asset name *">
                <Input
                  value={form.asset_name}
                  onChange={(e) => setForm((f) => ({ ...f, asset_name: e.target.value }))}
                />
              </Field>
              <Field label="Asset tag / barcode (optional)">
                <Input
                  value={form.asset_code}
                  onChange={(e) => setForm((f) => ({ ...f, asset_code: e.target.value }))}
                  placeholder="Printed tag or barcode value"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                System asset code is assigned automatically on save.
              </p>
              <Field label="Branch *">
                {branches.length > 0 ? (
                  <Select
                    value={form.branch_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.branch_id}
                    onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                    placeholder="Branch UUID"
                  />
                )}
              </Field>
              <Field label="Serial number">
                <Input
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                />
              </Field>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <Field label="Category *">
                <Select
                  value={form.asset_category_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, asset_category_id: v }))}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Asset type (PRD catalog)">
                <Select value={form.prd_type_id} onValueChange={onPrdType}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Optional PRD type" />
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
              <Field label="API asset_type *">
                <Select
                  value={form.asset_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, asset_type: v as (typeof API_ASSET_TYPES)[number] }))
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_ASSET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Field label="Purchase date">
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                />
              </Field>
              <Field label="Purchase cost">
                <Input
                  value={form.purchase_cost}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
                />
              </Field>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Field label="Location label">
                <Input
                  value={form.location_label}
                  onChange={(e) => setForm((f) => ({ ...f, location_label: e.target.value }))}
                />
              </Field>
              <Field label="Building">
                <Input
                  value={form.building}
                  onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
                />
              </Field>
              <Field label="Floor / Room">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Floor"
                    value={form.floor}
                    onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                  />
                  <Input
                    placeholder="Room"
                    value={form.room}
                    onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                  />
                </div>
              </Field>
              <p className="text-xs text-muted-foreground">
                Location history is recorded after save via the Locations API on the asset detail
                screen.
              </p>
            </>
          ) : null}
          {step === 4 ? (
            showTechnical ? (
              <>
                <Field label="Hostname">
                  <Input
                    value={form.hostname}
                    onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))}
                  />
                </Field>
                <Field label="MAC address">
                  <Input
                    value={form.mac_address}
                    onChange={(e) => setForm((f) => ({ ...f, mac_address: e.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Technical details apply to IT categories only. Skip or go back to change category.
              </p>
            )
          ) : null}
          {step === 5 ? (
            <dl className="space-y-2 text-sm">
              <Row k="Name" v={form.asset_name} />
              <Row k="Code" v={form.asset_code} />
              <Row k="Category" v={selectedCategory?.category_name ?? "—"} />
              <Row k="Type" v={form.asset_type} />
              <Row k="Location" v={form.location_label || "—"} />
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="cursor-pointer"
        >
          <ChevronLeft className="mr-1 size-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="cursor-pointer"
          >
            Next
            <ChevronRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button onClick={() => void submit()} disabled={saving} className="cursor-pointer">
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Create asset
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function BadgeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  );
}
