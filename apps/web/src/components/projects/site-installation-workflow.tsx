"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Cable,
  ClipboardCheck,
  CloudUpload,
  MapPin,
  Package,
  Server,
  Wrench,
} from "lucide-react";

import {
  linesFromMaterial,
  TypeQtyLinesEditor,
  type TypeQtyLineDraft,
  typeQtyLinesToMaterial,
} from "@/components/projects/material-type-qty-lines";
import {
  CABLE_TYPES,
  INDUSTRIAL_SOCKET_TYPES,
  LUG_TYPES,
  SITE_DELIVERY_TYPES,
  deliveryIncludesOs,
  deliveryIncludesRack,
  deliveryIsRackOnly,
  deliveryNeedsHwat,
  siteDeliveryTypeLabel,
  siteWorkflowStageLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsErrorBanner,
  ProjectsSection,
} from "@/components/projects/projects-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  advanceSiteInstallation,
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
  type SiteInstallation,
  type SiteInstallationBlueprint,
  type SiteInstallationFormInput,
} from "@/services/projects-portal-service";

type StageKey =
  | "intake"
  | "survey"
  | "scm"
  | "installation"
  | "configuration"
  | "acceptance"
  | "completed";

const STAGE_ICONS: Record<string, typeof MapPin> = {
  intake: ClipboardCheck,
  survey: MapPin,
  scm: Package,
  installation: Server,
  configuration: Wrench,
  acceptance: CloudUpload,
  completed: Check,
};

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex h-8 cursor-pointer items-center gap-2 self-end rounded-md border border-border/70 bg-background px-2.5 text-xs transition-colors duration-200",
        "hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-medium text-foreground">{label}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <Input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <Input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <Input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </label>
  );
}

function MaterialLinesField({
  label,
  lines,
  options,
  disabled,
  addLabel,
  onChange,
}: {
  label: string;
  lines: TypeQtyLineDraft[];
  options: { value: string; label: string }[];
  disabled?: boolean;
  addLabel: string;
  onChange: (next: TypeQtyLineDraft[]) => void;
}) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">
        {label}
        <span className="text-destructive"> *</span>
      </span>
      <TypeQtyLinesEditor
        value={JSON.stringify(lines)}
        options={options}
        disabled={disabled}
        addLabel={addLabel}
        onChange={(raw) => {
          try {
            const parsed = JSON.parse(raw) as TypeQtyLineDraft[];
            onChange(Array.isArray(parsed) ? parsed : [{ type: "", quantity: "", date: "" }]);
          } catch {
            onChange([{ type: "", quantity: "", date: "" }]);
          }
        }}
      />
    </div>
  );
}

type Draft = {
  delivery_type: string;
  requestor_name: string;
  circle: string;
  cloud_name: string;
  site_name: string;
  power_requirements: string;
  rfai_request_done: boolean;
  rfai_number: string;
  fabric_partner: string;
  application: string;
  cable_length: string;
  cable_lines: TypeQtyLineDraft[];
  industrial_socket: boolean;
  socket_lines: TypeQtyLineDraft[];
  lugs: boolean;
  lug_lines: TypeQtyLineDraft[];
  power_on_material: boolean;
  power_on_material_date: string;
  tile_details: string;
  survey_completed: boolean;
  survey_completed_date: string;
  space_available: boolean;
  space_available_date: string;
  power_available: boolean;
  power_available_date: string;
  server_qty: string;
  rack_qty: string;
  server_wh_delivery_date: string;
  server_on_site_delivery_date: string;
  rack_wh_delivery_date: string;
  rack_on_site_delivery_date: string;
  pdu_wh_delivery_date: string;
  pdu_on_site_delivery_date: string;
  mo_request: boolean;
  mo_request_date: string;
  im_material: boolean;
  im_material_date: string;
  material_handover_done: boolean;
  material_handover_date: string;
  rack_server_stacking_done: boolean;
  rack_server_power_on_done: boolean;
  dac_ilo_cabling_done: boolean;
  bios_configuration_done: boolean;
  firmware_nw_config_done: boolean;
  lld_done: boolean;
  os_installation_done: boolean;
  mbss_done: boolean;
  handover_to_cloud_done: boolean;
  hwat_request_done: boolean;
  hwat_signoff_received: boolean;
  remarks: string;
};

function fromRow(row: SiteInstallation): Draft {
  return {
    delivery_type: row.delivery_type,
    requestor_name: row.requestor_name ?? "",
    circle: row.circle ?? "",
    cloud_name: row.cloud_name ?? "",
    site_name: row.site_name ?? "",
    power_requirements: row.power_requirements ?? "",
    rfai_request_done: row.rfai_request_done ?? false,
    rfai_number: row.rfai_number ?? "",
    fabric_partner: row.fabric_partner ?? "",
    application: row.application ?? "",
    cable_length: row.cable_length ?? "",
    cable_lines: linesFromMaterial(row.cable_lines),
    industrial_socket: row.industrial_socket ?? false,
    socket_lines: linesFromMaterial(row.industrial_socket_lines),
    lugs: row.lugs ?? false,
    lug_lines: linesFromMaterial(row.lug_lines),
    power_on_material: row.power_on_material ?? false,
    power_on_material_date: row.power_on_material_date ?? "",
    tile_details: row.tile_details ?? "",
    survey_completed: row.survey_completed,
    survey_completed_date: row.survey_completed_date ?? "",
    space_available: row.space_available,
    space_available_date: row.space_available_date ?? "",
    power_available: row.power_available,
    power_available_date: row.power_available_date ?? "",
    server_qty: row.server_qty != null ? String(row.server_qty) : "",
    rack_qty: row.rack_qty != null ? String(row.rack_qty) : "",
    server_wh_delivery_date: row.server_wh_delivery_date ?? "",
    server_on_site_delivery_date: row.server_on_site_delivery_date ?? "",
    rack_wh_delivery_date: row.rack_wh_delivery_date ?? "",
    rack_on_site_delivery_date: row.rack_on_site_delivery_date ?? "",
    pdu_wh_delivery_date: row.pdu_wh_delivery_date ?? "",
    pdu_on_site_delivery_date: row.pdu_on_site_delivery_date ?? "",
    mo_request: row.mo_request,
    mo_request_date: row.mo_request_date ?? "",
    im_material: row.im_material,
    im_material_date: row.im_material_date ?? "",
    material_handover_done: row.material_handover_done ?? false,
    material_handover_date: row.material_handover_date ?? "",
    rack_server_stacking_done: row.rack_server_stacking_done,
    rack_server_power_on_done: row.rack_server_power_on_done,
    dac_ilo_cabling_done: row.dac_ilo_cabling_done,
    bios_configuration_done: row.bios_configuration_done,
    firmware_nw_config_done: row.firmware_nw_config_done ?? false,
    lld_done: row.lld_done,
    os_installation_done: row.os_installation_done ?? false,
    mbss_done: row.mbss_done ?? false,
    handover_to_cloud_done: row.handover_to_cloud_done,
    hwat_request_done: row.hwat_request_done,
    hwat_signoff_received: row.hwat_signoff_received,
    remarks: row.remarks ?? "",
  };
}

function toPayload(draft: Draft): SiteInstallationFormInput {
  const qty = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  const orNull = (v: string) => {
    const t = v.trim();
    return t === "" ? null : t;
  };
  return {
    delivery_type: draft.delivery_type,
    requestor_name: orNull(draft.requestor_name),
    circle: orNull(draft.circle),
    cloud_name: orNull(draft.cloud_name),
    site_name: orNull(draft.site_name),
    power_requirements: orNull(draft.power_requirements),
    rfai_request_done: draft.rfai_request_done,
    rfai_number: orNull(draft.rfai_number),
    fabric_partner: orNull(draft.fabric_partner),
    application: orNull(draft.application),
    cable_length: orNull(draft.cable_length),
    industrial_socket: draft.industrial_socket,
    lugs: draft.lugs,
    cable_lines: deliveryIncludesRack(draft.delivery_type)
      ? typeQtyLinesToMaterial(draft.cable_lines)
      : [],
    lug_lines: deliveryIncludesRack(draft.delivery_type)
      ? typeQtyLinesToMaterial(draft.lug_lines)
      : [],
    industrial_socket_lines: deliveryIncludesRack(draft.delivery_type)
      ? typeQtyLinesToMaterial(draft.socket_lines)
      : [],
    power_on_material: draft.power_on_material,
    power_on_material_date: draft.power_on_material
      ? orNull(draft.power_on_material_date)
      : null,
    tile_details: orNull(draft.tile_details),
    survey_completed: draft.survey_completed,
    survey_completed_date: draft.survey_completed
      ? orNull(draft.survey_completed_date)
      : null,
    space_available: draft.space_available,
    space_available_date: draft.space_available
      ? orNull(draft.space_available_date)
      : null,
    power_available: draft.power_available,
    power_available_date: draft.power_available
      ? orNull(draft.power_available_date)
      : null,
    server_qty: qty(draft.server_qty),
    rack_qty: deliveryIncludesRack(draft.delivery_type) ? qty(draft.rack_qty) : null,
    server_wh_delivery_date: orNull(draft.server_wh_delivery_date),
    server_on_site_delivery_date: orNull(draft.server_on_site_delivery_date),
    rack_wh_delivery_date: orNull(draft.rack_wh_delivery_date),
    rack_on_site_delivery_date: orNull(draft.rack_on_site_delivery_date),
    pdu_wh_delivery_date: orNull(draft.pdu_wh_delivery_date),
    pdu_on_site_delivery_date: orNull(draft.pdu_on_site_delivery_date),
    mo_request: draft.mo_request,
    mo_request_date: draft.mo_request ? orNull(draft.mo_request_date) : null,
    im_material: draft.im_material,
    im_material_date: draft.im_material ? orNull(draft.im_material_date) : null,
    material_handover_done: draft.material_handover_done,
    material_handover_date: draft.material_handover_done
      ? orNull(draft.material_handover_date)
      : null,
    rack_server_stacking_done: draft.rack_server_stacking_done,
    rack_server_power_on_done: draft.rack_server_power_on_done,
    dac_ilo_cabling_done: draft.dac_ilo_cabling_done,
    bios_configuration_done: draft.bios_configuration_done,
    firmware_nw_config_done: draft.firmware_nw_config_done,
    lld_done: draft.lld_done,
    os_installation_done: draft.os_installation_done,
    mbss_done: draft.mbss_done,
    handover_to_cloud_done: draft.handover_to_cloud_done,
    hwat_request_done: draft.hwat_request_done,
    hwat_signoff_received: draft.hwat_signoff_received,
    remarks: orNull(draft.remarks),
  };
}

export function SiteInstallationWorkflow({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const [row, setRow] = useState<SiteInstallation | null>(null);
  const [blueprint, setBlueprint] = useState<SiteInstallationBlueprint | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [site, bp] = await Promise.all([
        getSiteInstallationByProject(projectId),
        getSiteInstallationBlueprint(projectId),
      ]);
      setRow(site);
      setBlueprint(bp);
      setDraft(fromRow(site));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load site installation workflow",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = row?.status === "completed" || blueprint?.terminal === true;
  const stage = (blueprint?.state ?? row?.workflow_stage ?? "intake") as StageKey;
  const currentIdx = useMemo(() => {
    const stages = blueprint?.stages ?? [];
    return stages.findIndex((s) => s.key === stage);
  }, [blueprint, stage]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await updateSiteInstallationByProject(projectId, toPayload(draft));
      setRow(saved);
      setDraft(fromRow(saved));
      setBlueprint(await getSiteInstallationBlueprint(projectId));
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save site installation",
      );
    } finally {
      setBusy(false);
    }
  }

  async function advance(action: string) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      // Persist current stage fields first so gates see latest values
      await updateSiteInstallationByProject(projectId, toPayload(draft));
      const advanced = await advanceSiteInstallation(projectId, action);
      setRow(advanced);
      setDraft(fromRow(advanced));
      setBlueprint(await getSiteInstallationBlueprint(projectId));
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to advance workflow",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !row) {
    return <div className="h-36 animate-pulse rounded-xl bg-muted/60" />;
  }

  if (!row || !draft || !blueprint) {
    return <ProjectsErrorBanner>{error ?? "Site workflow unavailable."}</ProjectsErrorBanner>;
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <ProjectsSection
      title="Site Installation Workflow"
      subtitle={`${row.document_number} · ${siteDeliveryTypeLabel(row.delivery_type)} · ${siteWorkflowStageLabel(stage)}`}
      icon={Cable}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {stage === "survey" && !locked ? (
            <Link
              href={`/projects/projects/${projectId}/survey`}
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Open Survey form
            </Link>
          ) : null}
          {stage === "scm" && !locked ? (
            <Link
              href={`/projects/projects/${projectId}/scm`}
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Open SCM form
            </Link>
          ) : null}
          {stage === "installation" && !locked ? (
            <Link
              href={`/projects/projects/${projectId}/installation`}
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Open Installation form
            </Link>
          ) : null}
          {stage === "configuration" && !locked ? (
            <Link
              href={`/projects/projects/${projectId}/configuration`}
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Open Configuration form
            </Link>
          ) : null}
          {stage === "acceptance" && !locked ? (
            <Link
              href={`/projects/projects/${projectId}/acceptance`}
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              Open Acceptance form
            </Link>
          ) : null}
          {!locked ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => void save()}
            >
              Save stage
            </Button>
          ) : null}
          {(blueprint.allowed_actions ?? []).map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={busy || locked}
              onClick={() => void advance(action)}
            >
              {blueprint.action_labels?.[action] ?? action}
            </Button>
          ))}
        </div>
      }
    >
      {error ? <ProjectsErrorBanner>{error}</ProjectsErrorBanner> : null}

      <div className="erp-scroll mb-3 flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 px-2 py-2">
        {blueprint.stages.map((s, idx) => {
          const Icon = STAGE_ICONS[s.key] ?? ClipboardCheck;
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={s.key} className="flex items-center">
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                  isCurrent && "bg-primary/10 text-primary",
                  isDone && "text-emerald-700",
                  !isCurrent && !isDone && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isDone && "border-emerald-600 bg-emerald-600 text-white",
                    !isCurrent && !isDone && "border-border/80 bg-background",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : <Icon className="size-3" />}
                </span>
                {s.label}
              </div>
              {idx < blueprint.stages.length - 1 ? (
                <span className="mx-0.5 text-muted-foreground/50">›</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Header verticals — always visible; editable only in Intake */}
          <label className="grid gap-1 text-xs sm:col-span-2 lg:col-span-1">
            <span className="font-medium text-muted-foreground">Delivery Type</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={draft.delivery_type}
              disabled={locked || stage !== "intake"}
              onChange={(e) => set("delivery_type", e.target.value)}
            >
              {SITE_DELIVERY_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Site Name"
            required
            value={draft.site_name}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("site_name", v)}
          />
          <TextField
            label="Power Requirements"
            required
            value={draft.power_requirements}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("power_requirements", v)}
          />
          <CheckboxField
            label="RFAI Request"
            checked={draft.rfai_request_done}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("rfai_request_done", v)}
          />
          <TextField
            label="RFAI Number"
            required
            value={draft.rfai_number}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("rfai_number", v)}
          />
          <TextField
            label="Fabric Partner"
            value={draft.fabric_partner}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("fabric_partner", v)}
          />
          <TextField
            label="Application"
            value={draft.application}
            disabled={locked || stage !== "intake"}
            onChange={(v) => set("application", v)}
          />
        </div>

        {stage === "survey" && (
          <div className="space-y-3 border-t border-border/70 pt-3">
            {deliveryIncludesRack(draft.delivery_type) ? (
              <div className="grid items-start gap-3 lg:grid-cols-3">
                <MaterialLinesField
                  label="Cable"
                  lines={draft.cable_lines}
                  options={CABLE_TYPES}
                  disabled={locked}
                  addLabel="Add cable type"
                  onChange={(next) => set("cable_lines", next)}
                />
                <MaterialLinesField
                  label="Industrial Socket"
                  lines={draft.socket_lines}
                  options={INDUSTRIAL_SOCKET_TYPES}
                  disabled={locked}
                  addLabel="Add socket type"
                  onChange={(next) => set("socket_lines", next)}
                />
                <MaterialLinesField
                  label="Lugs"
                  lines={draft.lug_lines}
                  options={LUG_TYPES}
                  disabled={locked}
                  addLabel="Add lug type"
                  onChange={(next) => set("lug_lines", next)}
                />
              </div>
            ) : (
              <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TextField
                  label="Cable Length"
                  required
                  value={draft.cable_length}
                  disabled={locked}
                  onChange={(v) => set("cable_length", v)}
                />
                <CheckboxField
                  label="Industrial Socket"
                  checked={draft.industrial_socket}
                  disabled={locked}
                  onChange={(v) => set("industrial_socket", v)}
                />
                <CheckboxField
                  label="Lugs"
                  checked={draft.lugs}
                  disabled={locked}
                  onChange={(v) => set("lugs", v)}
                />
              </div>
            )}
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="Tile Details"
                required
                value={draft.tile_details}
                disabled={locked}
                onChange={(v) => set("tile_details", v)}
              />
              <CheckboxField
                label="Power-on Material"
                checked={draft.power_on_material}
                disabled={locked}
                onChange={(v) => {
                  set("power_on_material", v);
                  if (!v) set("power_on_material_date", "");
                }}
              />
              {draft.power_on_material ? (
                <DateField
                  label="Power-on Material Date"
                  required
                  value={draft.power_on_material_date}
                  disabled={locked}
                  onChange={(v) => set("power_on_material_date", v)}
                />
              ) : null}
              <CheckboxField
                label="Survey Completed"
                checked={draft.survey_completed}
                disabled={locked}
                onChange={(v) => {
                  set("survey_completed", v);
                  if (!v) set("survey_completed_date", "");
                }}
              />
              {draft.survey_completed ? (
                <DateField
                  label="Survey Completed Date"
                  required
                  value={draft.survey_completed_date}
                  disabled={locked}
                  onChange={(v) => set("survey_completed_date", v)}
                />
              ) : null}
              <CheckboxField
                label="Space Available"
                checked={draft.space_available}
                disabled={locked}
                onChange={(v) => {
                  set("space_available", v);
                  if (!v) set("space_available_date", "");
                }}
              />
              {draft.space_available ? (
                <DateField
                  label="Space Available Date"
                  required
                  value={draft.space_available_date}
                  disabled={locked}
                  onChange={(v) => set("space_available_date", v)}
                />
              ) : null}
              <CheckboxField
                label="Power Available"
                checked={draft.power_available}
                disabled={locked}
                onChange={(v) => {
                  set("power_available", v);
                  if (!v) set("power_available_date", "");
                }}
              />
              {draft.power_available ? (
                <DateField
                  label="Power Available Date"
                  required
                  value={draft.power_available_date}
                  disabled={locked}
                  onChange={(v) => set("power_available_date", v)}
                />
              ) : null}
            </div>
          </div>
        )}

        {stage === "scm" && (
          <div className="grid items-start gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Server QTY"
              required
              value={draft.server_qty}
              disabled={locked}
              onChange={(v) => set("server_qty", v)}
            />
            {deliveryIncludesRack(draft.delivery_type) ? (
              <NumberField
                label="Rack Qty"
                required
                value={draft.rack_qty}
                disabled={locked}
                onChange={(v) => set("rack_qty", v)}
              />
            ) : null}
            <DateField
              label="Server WH Delivery Date"
              value={draft.server_wh_delivery_date}
              disabled={locked}
              onChange={(v) => set("server_wh_delivery_date", v)}
            />
            <DateField
              label="Server On Site Delivery"
              value={draft.server_on_site_delivery_date}
              disabled={locked}
              onChange={(v) => set("server_on_site_delivery_date", v)}
            />
            {deliveryIncludesRack(draft.delivery_type) ? (
              <>
                <DateField
                  label="Rack WH Delivery Date"
                  value={draft.rack_wh_delivery_date}
                  disabled={locked}
                  onChange={(v) => set("rack_wh_delivery_date", v)}
                />
                <DateField
                  label="Rack On Site Delivery"
                  value={draft.rack_on_site_delivery_date}
                  disabled={locked}
                  onChange={(v) => set("rack_on_site_delivery_date", v)}
                />
              </>
            ) : null}
            <DateField
              label="PDU WH Delivery Date"
              value={draft.pdu_wh_delivery_date}
              disabled={locked}
              onChange={(v) => set("pdu_wh_delivery_date", v)}
            />
            <DateField
              label="PDU On Site Delivery Date"
              value={draft.pdu_on_site_delivery_date}
              disabled={locked}
              onChange={(v) => set("pdu_on_site_delivery_date", v)}
            />
            <CheckboxField
              label="MO Request"
              checked={draft.mo_request}
              disabled={locked}
              onChange={(v) => {
                set("mo_request", v);
                if (!v) set("mo_request_date", "");
              }}
            />
            {draft.mo_request ? (
              <DateField
                label="MO Request Date"
                required
                value={draft.mo_request_date}
                disabled={locked}
                onChange={(v) => set("mo_request_date", v)}
              />
            ) : null}
            <CheckboxField
              label="IM Material"
              checked={draft.im_material}
              disabled={locked}
              onChange={(v) => {
                set("im_material", v);
                if (!v) set("im_material_date", "");
              }}
            />
            {draft.im_material ? (
              <DateField
                label="IM Material Date"
                required
                value={draft.im_material_date}
                disabled={locked}
                onChange={(v) => set("im_material_date", v)}
              />
            ) : null}
            <CheckboxField
              label="Material Handover (WH → Site)"
              checked={draft.material_handover_done}
              disabled={locked}
              onChange={(v) => {
                set("material_handover_done", v);
                if (!v) set("material_handover_date", "");
              }}
            />
            {draft.material_handover_done ? (
              <DateField
                label="Material Handover Date"
                required
                value={draft.material_handover_date}
                disabled={locked}
                onChange={(v) => set("material_handover_date", v)}
              />
            ) : null}
          </div>
        )}

        {stage === "installation" && (
          <div className="grid items-start gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <CheckboxField
              label={
                deliveryIsRackOnly(draft.delivery_type)
                  ? "Rack Installation"
                  : "Rack Installation + Server Stacking"
              }
              checked={draft.rack_server_stacking_done}
              disabled={locked}
              onChange={(v) => set("rack_server_stacking_done", v)}
            />
            {!deliveryIsRackOnly(draft.delivery_type) ? (
              <>
                <CheckboxField
                  label="Rack + Server Power On"
                  checked={draft.rack_server_power_on_done}
                  disabled={locked}
                  onChange={(v) => set("rack_server_power_on_done", v)}
                />
                <CheckboxField
                  label="DAC/ILO Cabling"
                  checked={draft.dac_ilo_cabling_done}
                  disabled={locked}
                  onChange={(v) => set("dac_ilo_cabling_done", v)}
                />
              </>
            ) : (
              <p className="self-center text-xs text-muted-foreground sm:col-span-2">
                Rack Installation only: skip server power-on / DAC-ILO — advance to Handover to
                Cloud.
              </p>
            )}
          </div>
        )}

        {stage === "configuration" && (
          <div className="grid items-start gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <CheckboxField
              label="BIOS Configuration"
              checked={draft.bios_configuration_done}
              disabled={locked}
              onChange={(v) => set("bios_configuration_done", v)}
            />
            <CheckboxField
              label="Firmware / N/W Configuration"
              checked={draft.firmware_nw_config_done}
              disabled={locked}
              onChange={(v) => set("firmware_nw_config_done", v)}
            />
            <CheckboxField
              label="LLD Availability"
              checked={draft.lld_done}
              disabled={locked}
              onChange={(v) => set("lld_done", v)}
            />
            {deliveryIncludesOs(draft.delivery_type) ? (
              <>
                <CheckboxField
                  label="OS Installation"
                  checked={draft.os_installation_done}
                  disabled={locked}
                  onChange={(v) => set("os_installation_done", v)}
                />
                <CheckboxField
                  label="MBSS"
                  checked={draft.mbss_done}
                  disabled={locked}
                  onChange={(v) => set("mbss_done", v)}
                />
              </>
            ) : null}
          </div>
        )}

        {stage === "acceptance" && (
          <div className="grid items-start gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <CheckboxField
              label="Handover to Cloud (HO Cloud)"
              checked={draft.handover_to_cloud_done}
              disabled={locked}
              onChange={(v) => set("handover_to_cloud_done", v)}
            />
            {deliveryNeedsHwat(draft.delivery_type) ? (
              <>
                <CheckboxField
                  label="HWAT Request"
                  checked={draft.hwat_request_done}
                  disabled={locked}
                  onChange={(v) => set("hwat_request_done", v)}
                />
                <CheckboxField
                  label="HWAT Sign off received from Circle"
                  checked={draft.hwat_signoff_received}
                  disabled={locked}
                  onChange={(v) => set("hwat_signoff_received", v)}
                />
              </>
            ) : (
              <p className="self-center text-xs text-muted-foreground sm:col-span-2">
                Rack Installation only: HWAT is skipped — complete Handover to Cloud to close.
              </p>
            )}
          </div>
        )}

        <label className="grid gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Remarks</span>
          <textarea
            value={draft.remarks}
            disabled={locked}
            rows={2}
            onChange={(e) => set("remarks", e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
    </ProjectsSection>
  );
}
