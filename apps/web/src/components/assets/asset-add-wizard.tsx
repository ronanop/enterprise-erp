"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { markInventoryStale } from "@/components/assets/inventory/inventory-refresh";
import { stashInventoryArrival } from "@/components/assets/inventory/inventory-arrival";
import { useAssetNavigation } from "@/components/assets/navigation/use-asset-navigation";
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
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { listBranchOptions, type OrgOption } from "@/lib/org-options";
import {
  DEMO_ASSET_BRANCHES,
  DEMO_ASSET_CATEGORIES,
  coerceOptionId,
  isDemoBranchId,
  isDemoCategoryId,
  resolveDemoBranches,
  resolveDemoCategories,
} from "@/components/assets/demo-asset-master";
import { stashDemoRegisteredAsset } from "@/components/assets/demo-registered-assets";
import { buildSelfServiceUrl } from "@/services/assets-service";
import {
  assetCategoryService,
  assetRegisterService,
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
  const navigation = useAssetNavigation();
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
      const seedCategories = DEMO_ASSET_CATEGORIES;
      const seedBranches = DEMO_ASSET_BRANCHES;
      setCategories(seedCategories);
      setBranches(seedBranches);
      setForm((f) => ({
        ...f,
        asset_category_id: coerceOptionId(
          f.asset_category_id,
          seedCategories.map((c) => c.id),
        ),
        branch_id: coerceOptionId(
          f.branch_id,
          seedBranches.map((b) => b.id),
        ),
      }));

      if (!isAuthenticated()) return;
      try {
        const [payload, branchOpts] = await Promise.all([
          assetCategoryService.search({
            page: 1,
            page_size: 200,
            status: "active",
          }),
          listBranchOptions().catch(() => [] as OrgOption[]),
        ]);
        const nextCategories = resolveDemoCategories(filterActiveCategories(payload.items));
        const nextBranches = resolveDemoBranches(branchOpts);
        setCategories(nextCategories);
        setBranches(nextBranches);
        setForm((f) => ({
          ...f,
          // Remap when options change so Select never holds a stale demo id.
          asset_category_id: coerceOptionId(
            f.asset_category_id,
            nextCategories.map((c) => c.id),
          ),
          branch_id: coerceOptionId(
            f.branch_id,
            nextBranches.map((b) => b.id),
          ),
        }));
      } catch (err) {
        setCategories(DEMO_ASSET_CATEGORIES);
        setBranches(DEMO_ASSET_BRANCHES);
        setForm((f) => ({
          ...f,
          asset_category_id: coerceOptionId(
            f.asset_category_id,
            DEMO_ASSET_CATEGORIES.map((c) => c.id),
          ),
          branch_id: coerceOptionId(
            f.branch_id,
            DEMO_ASSET_BRANCHES.map((b) => b.id),
          ),
        }));
        setError(
          err instanceof ApiClientError
            ? `${err.message} Showing demo categories for walkthrough.`
            : "API unavailable — showing demo categories for walkthrough.",
        );
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

  const selectedBranch = branches.find((b) => b.id === form.branch_id);

  function finishLocalDemoCreate() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `demo-${Date.now()}`;
    stashDemoRegisteredAsset({
      id,
      asset_code: form.asset_code.trim(),
      asset_name: form.asset_name.trim(),
      asset_type: form.asset_type,
      asset_category_id: form.asset_category_id,
      category_name: selectedCategory?.category_name ?? "—",
      branch_id: form.branch_id.trim(),
      branch_label: selectedBranch?.label ?? "Demo Branch",
      serial_number: form.serial_number.trim() || undefined,
      location_label: form.location_label.trim() || undefined,
      operational_status: "READY_TO_MOVE",
      created_at: new Date().toISOString(),
    });
    stashInventoryArrival({
      reason: "register",
      assetId: id,
      toastMessage: "Asset registered (demo). Showing on Asset Register.",
    });
    markInventoryStale({ reason: "register", assetId: id });
    navigation.openInventory(id);
  }

  async function submit() {
    setError(null);
    if (!form.asset_name.trim()) {
      setError("Asset name is required.");
      return;
    }
    if (!form.asset_code.trim()) {
      setError("Asset code is required.");
      return;
    }
    if (!form.asset_category_id) {
      setError("Category is required.");
      return;
    }
    if (!form.branch_id.trim()) {
      setError("Branch is required. Go back to Basic and select a branch.");
      return;
    }
    if (!UUID_RE.test(form.branch_id.trim())) {
      setError("Select a valid branch.");
      return;
    }

    const useDemoCreate =
      !isAuthenticated() ||
      isDemoBranchId(form.branch_id) ||
      isDemoCategoryId(form.asset_category_id);

    if (useDemoCreate) {
      setSaving(true);
      try {
        finishLocalDemoCreate();
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const created = await assetRegisterService.create({
        branch_id: form.branch_id.trim(),
        asset_category_id: form.asset_category_id,
        asset_name: form.asset_name.trim(),
        asset_code: form.asset_code.trim(),
        asset_type: form.asset_type,
        serial_number: form.serial_number.trim() || undefined,
        purchase_date: form.purchase_date,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : undefined,
        currency_code: form.currency_code,
      });
      const id = String(created.id);
      const qr = typeof window !== "undefined" ? buildSelfServiceUrl(id) : undefined;
      if (qr) {
        await assetRegisterService.update(id, { qr_code: qr });
      }
      await assetRegisterService.action(id, "submit").catch(() => undefined);
      await assetRegisterService.action(id, "approve").catch(() => undefined);
      stashInventoryArrival({
        reason: "register",
        assetId: id,
        toastMessage: "Asset registered successfully.",
      });
      markInventoryStale({ reason: "register", assetId: id });
      navigation.openInventory(id);
    } catch {
      // Fall back to demo register so the walkthrough still lands on Asset Register.
      finishLocalDemoCreate();
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
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "cursor-pointer transition-colors duration-200",
            )}
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
              <Field label="Asset code *">
                <Input
                  value={form.asset_code}
                  onChange={(e) => setForm((f) => ({ ...f, asset_code: e.target.value }))}
                />
              </Field>
              <Field label="Serial number">
                <Input
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                />
              </Field>
              <Field label="Branch *">
                {branches.length > 0 ? (
                  <Select
                    value={form.branch_id || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}
                  >
                    <SelectTrigger className="cursor-pointer" data-testid="register-branch-select">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.branch_id}
                    onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                    placeholder="Branch UUID (Master Data branches unavailable)"
                    data-testid="register-branch-input"
                  />
                )}
              </Field>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <Field label="Category *">
                <Select
                  value={form.asset_category_id || undefined}
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
              <Row k="Branch" v={(selectedBranch?.label ?? form.branch_id) || "—"} />
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
