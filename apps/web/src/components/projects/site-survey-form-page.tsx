"use client";

import { useCallback, useMemo } from "react";
import { MapPin } from "lucide-react";

import {
  linesFromMaterial,
  serializeTypeQtyLines,
  typeQtyLinesToMaterial,
  parseTypeQtyLines,
} from "@/components/projects/material-type-qty-lines";
import {
  CABLE_TYPES,
  INDUSTRIAL_SOCKET_TYPES,
  LUG_TYPES,
  deliveryIncludesRack,
} from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";

const EMPTY_LINES = serializeTypeQtyLines([{ type: "", quantity: "", date: "" }]);

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "",
  cable_length: "",
  cable_lines: EMPTY_LINES,
  industrial_socket: "false",
  socket_lines: EMPTY_LINES,
  lugs: "false",
  lug_lines: EMPTY_LINES,
  power_on_material: "false",
  power_on_material_date: "",
  survey_completed: "false",
  survey_completed_date: "",
  space_available: "false",
  space_available_date: "",
  power_available: "false",
  power_available_date: "",
  tile_details: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function isRack(values: FormValues): boolean {
  return deliveryIncludesRack(values.delivery_type);
}

function dateOrNull(v: string | undefined): string | null {
  return orNull(v);
}

export function SiteSurveyFormPage({ projectId }: { projectId: string }) {
  const load = useCallback(async () => {
    const [project, site] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
    ]);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: site.delivery_type ?? "",
        cable_length: site.cable_length ?? "",
        cable_lines: serializeTypeQtyLines(linesFromMaterial(site.cable_lines)),
        industrial_socket: site.industrial_socket ? "true" : "false",
        socket_lines: serializeTypeQtyLines(
          linesFromMaterial(site.industrial_socket_lines),
        ),
        lugs: site.lugs ? "true" : "false",
        lug_lines: serializeTypeQtyLines(linesFromMaterial(site.lug_lines)),
        power_on_material: site.power_on_material ? "true" : "false",
        power_on_material_date: site.power_on_material_date ?? "",
        survey_completed: site.survey_completed ? "true" : "false",
        survey_completed_date: site.survey_completed_date ?? "",
        space_available: site.space_available ? "true" : "false",
        space_available_date: site.space_available_date ?? "",
        power_available: site.power_available ? "true" : "false",
        power_available_date: site.power_available_date ?? "",
        tile_details: site.tile_details ?? "",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const rack = isRack(v);
      const readiness = {
        power_on_material: asBool(v.power_on_material),
        power_on_material_date: asBool(v.power_on_material)
          ? dateOrNull(v.power_on_material_date)
          : null,
        survey_completed: asBool(v.survey_completed),
        survey_completed_date: asBool(v.survey_completed)
          ? dateOrNull(v.survey_completed_date)
          : null,
        space_available: asBool(v.space_available),
        space_available_date: asBool(v.space_available)
          ? dateOrNull(v.space_available_date)
          : null,
        power_available: asBool(v.power_available),
        power_available_date: asBool(v.power_available)
          ? dateOrNull(v.power_available_date)
          : null,
        tile_details: orNull(v.tile_details),
      };

      if (rack) {
        await updateSiteInstallationByProject(projectId, {
          cable_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.cable_lines)),
          lug_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.lug_lines)),
          industrial_socket_lines: typeQtyLinesToMaterial(
            parseTypeQtyLines(v.socket_lines),
          ),
          ...readiness,
        });
      } else {
        await updateSiteInstallationByProject(projectId, {
          cable_length: orNull(v.cable_length),
          industrial_socket: asBool(v.industrial_socket),
          lugs: asBool(v.lugs),
          cable_lines: [],
          lug_lines: [],
          industrial_socket_lines: [],
          ...readiness,
        });
      }

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "intake") {
        site = await advanceSiteInstallation(projectId, "complete_intake");
      }
      if (site.workflow_stage === "survey") {
        await advanceSiteInstallation(projectId, "complete_survey");
      }

      return `/projects/projects/${projectId}/scm`;
    },
    [projectId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Survey",
        subtitle: "Step 2 — Site readiness checks. Next: SCM / Logistics.",
        icon: MapPin,
        fields: [
          {
            name: "project_label",
            label: "Project",
            type: "readonly",
          },
          {
            name: "site_name",
            label: "Site",
            type: "readonly",
          },
          {
            name: "cable_lines",
            label: "Cable",
            type: "type_qty_lines",
            required: true,
            full: true,
            options: CABLE_TYPES,
            addLabel: "Add cable type",
            visibleWhen: isRack,
          },
          {
            name: "cable_length",
            label: "Cable Length",
            type: "text",
            required: true,
            placeholder: "e.g. 25 m",
            visibleWhen: (v) => !isRack(v),
          },
          {
            name: "socket_lines",
            label: "Industrial Socket",
            type: "type_qty_lines",
            required: true,
            full: true,
            options: INDUSTRIAL_SOCKET_TYPES,
            addLabel: "Add socket type",
            visibleWhen: isRack,
          },
          {
            name: "industrial_socket",
            label: "Industrial Socket",
            type: "checkbox",
            required: true,
            visibleWhen: (v) => !isRack(v),
          },
          {
            name: "lug_lines",
            label: "Lugs",
            type: "type_qty_lines",
            required: true,
            full: true,
            options: LUG_TYPES,
            addLabel: "Add lug type",
            visibleWhen: isRack,
          },
          {
            name: "lugs",
            label: "Lugs",
            type: "checkbox",
            required: true,
            visibleWhen: (v) => !isRack(v),
          },
          {
            name: "tile_details",
            label: "Tile Details",
            type: "textarea",
            required: true,
            full: true,
            placeholder: "Raised floor / tile cut / load notes…",
          },
          {
            name: "power_on_material",
            label: "Power-on Material",
            type: "checkbox",
            required: true,
            clearFieldsOnChange: ["power_on_material_date"],
          },
          {
            name: "power_on_material_date",
            label: "Power-on Material Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.power_on_material === "true",
          },
          {
            name: "survey_completed",
            label: "Survey Completed",
            type: "checkbox",
            required: true,
            clearFieldsOnChange: ["survey_completed_date"],
          },
          {
            name: "survey_completed_date",
            label: "Survey Completed Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.survey_completed === "true",
          },
          {
            name: "space_available",
            label: "Space Available",
            type: "checkbox",
            required: true,
            clearFieldsOnChange: ["space_available_date"],
          },
          {
            name: "space_available_date",
            label: "Space Available Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.space_available === "true",
          },
          {
            name: "power_available",
            label: "Power Available",
            type: "checkbox",
            required: true,
            clearFieldsOnChange: ["power_available_date"],
          },
          {
            name: "power_available_date",
            label: "Power Available Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.power_available === "true",
          },
        ],
      },
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="Survey"
      description="Step 2 — For rack scopes, add cable / socket / lug type, quantity, and date. Complete site readiness checks with dates."
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete Survey"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
