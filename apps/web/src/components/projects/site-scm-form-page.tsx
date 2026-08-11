"use client";

import { useCallback, useMemo } from "react";
import { Package, Truck, Warehouse, Cable } from "lucide-react";

import {
  linesFromMaterial,
  serializeTypeQtyLines,
  parseTypeQtyLines,
  typeQtyLinesToMaterial,
} from "@/components/projects/material-type-qty-lines";
import {
  CABLE_TYPES,
  INDUSTRIAL_SOCKET_TYPES,
  LUG_TYPES,
  deliveryIncludesRack,
  deliveryIncludesServer,
  deliveryIsRackOnly,
} from "@/components/projects/projects-domain";
import {
  intOrNull,
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  INTAKE_SUMMARY_EMPTY,
  intakeSummarySection,
  intakeSummaryValues,
  loadIntakeSummaryLookups,
} from "@/components/projects/site-intake-summary";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";
import { useSiteStageFormReadOnly } from "@/components/projects/site-stage-form-read-only-context";

const EMPTY_LINES = serializeTypeQtyLines([{ type: "", quantity: "", date: "" }]);

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  stage_assignee_label: "",
  cable_lines: EMPTY_LINES,
  socket_lines: EMPTY_LINES,
  lug_lines: EMPTY_LINES,
  server_qty: "",
  rack_qty: "",
  server_wh_delivery_date: "",
  server_on_site_delivery_date: "",
  rack_wh_delivery_date: "",
  rack_on_site_delivery_date: "",
  pdu_wh_delivery_date: "",
  pdu_on_site_delivery_date: "",
  mo_request: "false",
  mo_request_date: "",
  im_material: "false",
  im_material_date: "",
  power_on_material: "false",
  power_on_material_date: "",
  material_handover_done: "false",
  material_handover_date: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

function isRack(values: FormValues): boolean {
  return deliveryIncludesRack(values.delivery_type);
}

function isServer(values: FormValues): boolean {
  return deliveryIncludesServer(values.delivery_type);
}

function isRackOnly(values: FormValues): boolean {
  return deliveryIsRackOnly(values.delivery_type);
}

export function SiteScmFormPage({ projectId }: { projectId: string }) {
  const adminProgressView = useSiteStageFormReadOnly();
  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const owner = resolveStageOwnerDisplay(site, "scm", lookups.employees);

    return {
      values: {
        ...intakeSummaryValues({
          project,
          site,
          branches: lookups.branches,
          customers: lookups.customers,
          employees: lookups.employees,
        }),
        delivery_type: site.delivery_type ?? "",
        stage_assignee_label: owner.stage_assignee_label,
        cable_lines: serializeTypeQtyLines(linesFromMaterial(site.cable_lines)),
        socket_lines: serializeTypeQtyLines(
          linesFromMaterial(site.industrial_socket_lines),
        ),
        lug_lines: serializeTypeQtyLines(linesFromMaterial(site.lug_lines)),
        server_qty: site.server_qty != null ? String(site.server_qty) : "",
        rack_qty: site.rack_qty != null ? String(site.rack_qty) : "",
        server_wh_delivery_date: dateOrEmpty(site.server_wh_delivery_date),
        server_on_site_delivery_date: dateOrEmpty(site.server_on_site_delivery_date),
        rack_wh_delivery_date: dateOrEmpty(site.rack_wh_delivery_date),
        rack_on_site_delivery_date: dateOrEmpty(site.rack_on_site_delivery_date),
        pdu_wh_delivery_date: dateOrEmpty(site.pdu_wh_delivery_date),
        pdu_on_site_delivery_date: dateOrEmpty(site.pdu_on_site_delivery_date),
        mo_request: site.mo_request ? "true" : "false",
        mo_request_date: dateOrEmpty(site.mo_request_date),
        im_material: site.im_material ? "true" : "false",
        im_material_date: dateOrEmpty(site.im_material_date),
        power_on_material: site.power_on_material ? "true" : "false",
        power_on_material_date: dateOrEmpty(site.power_on_material_date),
        material_handover_done: site.material_handover_done ? "true" : "false",
        material_handover_date: dateOrEmpty(site.material_handover_date),
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const rack = isRack(v);
      const server = isServer(v);
      const rackOnly = isRackOnly(v);

      await updateSiteInstallationByProject(projectId, {
        ...(rack
          ? {
            cable_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.cable_lines)),
            industrial_socket_lines: typeQtyLinesToMaterial(
              parseTypeQtyLines(v.socket_lines),
            ),
            lug_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.lug_lines)),
          }
          : {
            cable_lines: [],
            industrial_socket_lines: [],
            lug_lines: [],
          }),
        server_qty: server ? intOrNull(v.server_qty) : null,
        rack_qty: rack ? intOrNull(v.rack_qty) : null,
        server_wh_delivery_date: server ? orNull(v.server_wh_delivery_date) : null,
        server_on_site_delivery_date: server
          ? orNull(v.server_on_site_delivery_date)
          : null,
        rack_wh_delivery_date: rack ? orNull(v.rack_wh_delivery_date) : null,
        rack_on_site_delivery_date: rack ? orNull(v.rack_on_site_delivery_date) : null,
        pdu_wh_delivery_date: orNull(v.pdu_wh_delivery_date),
        pdu_on_site_delivery_date: orNull(v.pdu_on_site_delivery_date),
        mo_request: asBool(v.mo_request),
        mo_request_date: asBool(v.mo_request) ? orNull(v.mo_request_date) : null,
        im_material: asBool(v.im_material),
        im_material_date: asBool(v.im_material) ? orNull(v.im_material_date) : null,
        power_on_material: rackOnly ? false : asBool(v.power_on_material),
        power_on_material_date:
          rackOnly || !asBool(v.power_on_material)
            ? null
            : orNull(v.power_on_material_date),
        material_handover_done: asBool(v.material_handover_done),
        material_handover_date: asBool(v.material_handover_done)
          ? orNull(v.material_handover_date)
          : null,
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "survey") {
        site = await advanceSiteInstallation(projectId, "complete_survey");
      }
      if (site.workflow_stage === "scm") {
        await advanceSiteInstallation(projectId, "complete_scm");
      }

      return `/projects/my-jobs`;
    },
    [projectId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      intakeSummarySection(),
      stageOwnerBannerSection(),
      {
        title: "Site materials delivery",
        subtitle:
          "Types and quantities come from Survey (read-only). Enter the delivery date for each line.",
        icon: Cable,
        fields: [
          {
            name: "cable_lines",
            label: "Cable",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: true,
            datesOnly: true,
            options: CABLE_TYPES,
            visibleWhen: isRack,
          },
          {
            name: "socket_lines",
            label: "Industrial Socket",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: true,
            datesOnly: true,
            options: INDUSTRIAL_SOCKET_TYPES,
            visibleWhen: isRack,
          },
          {
            name: "lug_lines",
            label: "Lugs",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: true,
            datesOnly: true,
            options: LUG_TYPES,
            visibleWhen: isRack,
          },
        ],
      },
      {
        title: "Material order",
        subtitle: "Step 4 — Raise the MO and capture quantities. Next: Installation.",
        icon: Truck,
        fields: [
          {
            name: "mo_request",
            label: "MO Request",
            type: "checkbox",
            hint: "Material order raised (MO → Warehouse → Site).",
            clearFieldsOnChange: ["mo_request_date"],
          },
          {
            name: "mo_request_date",
            label: "MO Request Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.mo_request === "true",
          },
          {
            name: "server_qty",
            label: "Server Qty",
            type: "number",
            required: true,
            min: "0",
            step: "1",
            visibleWhen: isServer,
          },
          {
            name: "rack_qty",
            label: "Rack Qty",
            type: "number",
            required: true,
            min: "0",
            step: "1",
            visibleWhen: isRack,
          },
        ],
      },
      {
        title: "Warehouse & on-site delivery",
        subtitle: "Track WH and site delivery dates for in-scope materials.",
        icon: Warehouse,
        columns: 3,
        fields: [
          {
            name: "server_wh_delivery_date",
            label: "Server WH Delivery",
            type: "date",
            visibleWhen: isServer,
          },
          {
            name: "server_on_site_delivery_date",
            label: "Server On-site Delivery",
            type: "date",
            visibleWhen: isServer,
          },
          {
            name: "rack_wh_delivery_date",
            label: "Rack WH Delivery",
            type: "date",
            visibleWhen: isRack,
          },
          {
            name: "rack_on_site_delivery_date",
            label: "Rack On-site Delivery",
            type: "date",
            visibleWhen: isRack,
          },
          {
            name: "pdu_wh_delivery_date",
            label: "PDU WH Delivery",
            type: "date",
          },
          {
            name: "pdu_on_site_delivery_date",
            label: "PDU On-site Delivery",
            type: "date",
          },
        ],
      },
      {
        title: "IM material & handover",
        subtitle: "Confirm IM material and warehouse-to-site handover.",
        icon: Package,
        fields: [
          {
            name: "im_material",
            label: "IM Material",
            type: "checkbox",
            clearFieldsOnChange: ["im_material_date"],
          },
          {
            name: "im_material_date",
            label: "IM Material Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.im_material === "true",
          },
          {
            name: "power_on_material",
            label: "Power-on Material",
            type: "checkbox",
            clearFieldsOnChange: ["power_on_material_date"],
            visibleWhen: (v) => !isRackOnly(v),
          },
          {
            name: "power_on_material_date",
            label: "Power-on Material Date",
            type: "date",
            required: true,
            visibleWhen: (v) => !isRackOnly(v) && v.power_on_material === "true",
          },
          {
            name: "material_handover_done",
            label: "Material Handover (WH → Site)",
            type: "checkbox",
            clearFieldsOnChange: ["material_handover_date"],
          },
          {
            name: "material_handover_date",
            label: "Material Handover Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.material_handover_done === "true",
          },
        ],
      },
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="SCM / Logistics"
      description="Step 4 — Track MO request, warehouse and on-site delivery for in-scope materials, IM material, and handover."
      backHref={
        adminProgressView ? `/projects/projects/${projectId}` : `/projects/my-jobs`
      }
      backLabel={adminProgressView ? "Back to project" : "Back to My Jobs"}
      readOnly={adminProgressView}
      readOnlyBanner={
        adminProgressView ? "Viewing completed step progress (read-only)." : undefined
      }
      submitLabel="Save"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
