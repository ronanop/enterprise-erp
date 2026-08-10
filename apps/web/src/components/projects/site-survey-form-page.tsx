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
  INTAKE_SUMMARY_EMPTY,
  intakeSummarySection,
  intakeSummaryValues,
  loadIntakeSummaryLookups,
} from "@/components/projects/site-intake-summary";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";

const EMPTY_LINES = serializeTypeQtyLines([{ type: "", quantity: "", date: "" }]);

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  stage_assignee_label: "",
  cable_length: "",
  cable_lines: EMPTY_LINES,
  industrial_socket: "false",
  socket_lines: EMPTY_LINES,
  lugs: "false",
  lug_lines: EMPTY_LINES,
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
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const owner = resolveStageOwnerDisplay(site, "survey", lookups.employees);

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
        cable_length: site.cable_length ?? "",
        cable_lines: serializeTypeQtyLines(linesFromMaterial(site.cable_lines)),
        industrial_socket: site.industrial_socket ? "true" : "false",
        socket_lines: serializeTypeQtyLines(
          linesFromMaterial(site.industrial_socket_lines),
        ),
        lugs: site.lugs ? "true" : "false",
        lug_lines: serializeTypeQtyLines(linesFromMaterial(site.lug_lines)),
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
        // Non-rack scopes skip cable / socket / lug capture.
        await updateSiteInstallationByProject(projectId, {
          cable_length: null,
          industrial_socket: false,
          lugs: false,
          cable_lines: [],
          lug_lines: [],
          industrial_socket_lines: [],
          ...readiness,
        });
      }

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "assignment") {
        site = await advanceSiteInstallation(projectId, "complete_assignment");
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
      intakeSummarySection(),
      stageOwnerBannerSection(),
      {
        title: "Survey",
        subtitle: "Step 3 — Site readiness checks. Next: SCM / Logistics.",
        icon: MapPin,
        fields: [
          {
            name: "cable_lines",
            label: "Cable",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: false,
            options: CABLE_TYPES,
            addLabel: "Add cable type",
            visibleWhen: isRack,
          },
          {
            name: "socket_lines",
            label: "Industrial Socket",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: false,
            options: INDUSTRIAL_SOCKET_TYPES,
            addLabel: "Add socket type",
            visibleWhen: isRack,
          },
          {
            name: "lug_lines",
            label: "Lugs",
            type: "type_qty_lines",
            required: true,
            full: true,
            showDate: false,
            options: LUG_TYPES,
            addLabel: "Add lug type",
            visibleWhen: isRack,
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
        ],
      },
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="Survey"
      description="Step 3 — Site readiness checks. Next: SCM / Logistics."
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Save & continue to SCM"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
