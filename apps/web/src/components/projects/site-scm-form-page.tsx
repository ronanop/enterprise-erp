"use client";

import { useCallback, useMemo } from "react";
import { Package, Truck, Warehouse } from "lucide-react";

import { deliveryIncludesRack } from "@/components/projects/projects-domain";
import {
  intOrNull,
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  listEmployeeOptions,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "",
  stage_assignee_label: "",
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

export function SiteScmFormPage({ projectId }: { projectId: string }) {
  const load = useCallback(async () => {
    const [project, site, employees] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      listEmployeeOptions().catch(() => []),
    ]);
    const owner = resolveStageOwnerDisplay(site, "scm", employees);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: site.delivery_type ?? "",
        stage_assignee_label: owner.stage_assignee_label,
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
        material_handover_done: site.material_handover_done ? "true" : "false",
        material_handover_date: dateOrEmpty(site.material_handover_date),
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      await updateSiteInstallationByProject(projectId, {
        server_qty: intOrNull(v.server_qty),
        rack_qty: isRack(v) ? intOrNull(v.rack_qty) : null,
        server_wh_delivery_date: orNull(v.server_wh_delivery_date),
        server_on_site_delivery_date: orNull(v.server_on_site_delivery_date),
        rack_wh_delivery_date: isRack(v) ? orNull(v.rack_wh_delivery_date) : null,
        rack_on_site_delivery_date: isRack(v)
          ? orNull(v.rack_on_site_delivery_date)
          : null,
        pdu_wh_delivery_date: orNull(v.pdu_wh_delivery_date),
        pdu_on_site_delivery_date: orNull(v.pdu_on_site_delivery_date),
        mo_request: asBool(v.mo_request),
        mo_request_date: asBool(v.mo_request) ? orNull(v.mo_request_date) : null,
        im_material: asBool(v.im_material),
        im_material_date: asBool(v.im_material) ? orNull(v.im_material_date) : null,
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

      return `/projects/projects/${projectId}/installation`;
    },
    [projectId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      stageOwnerBannerSection(),
      {
        title: "SCM / Logistics",
        subtitle: "Step 4 — MO → WH → Site. Next: Installation.",
        icon: Package,
        fields: [
          { name: "project_label", label: "Project", type: "readonly" },
          { name: "site_name", label: "Site", type: "readonly" },
        ],
      },
      {
        title: "Material order",
        subtitle: "Raise the MO and capture quantities.",
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
        subtitle: "Track WH and site delivery dates for server, rack, and PDU.",
        icon: Warehouse,
        columns: 3,
        fields: [
          {
            name: "server_wh_delivery_date",
            label: "Server WH Delivery",
            type: "date",
          },
          {
            name: "server_on_site_delivery_date",
            label: "Server On-site Delivery",
            type: "date",
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
      description="Step 4 — Track MO request, warehouse and on-site delivery for server / rack / PDU, IM material, and handover."
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete SCM"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
