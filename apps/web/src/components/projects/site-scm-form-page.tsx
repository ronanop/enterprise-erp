"use client";

import { useCallback, useMemo } from "react";
import { Cable, Warehouse } from "lucide-react";

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
import { isProgressCompleteForAdvance, stageClosingSections } from "@/components/projects/site-stage-attachment";
import { useSiteStageFormReadOnlyMeta } from "@/components/projects/site-stage-form-read-only-context";
import { SiteStageExportButton } from "@/components/projects/site-stage-export-button";

const EMPTY_LINES = serializeTypeQtyLines([
  { type: "", otherLabel: "", quantity: "", delivered: "", date: "" },
]);

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  stage_assignee_label: "",
  cable_lines: EMPTY_LINES,
  socket_lines: EMPTY_LINES,
  lug_lines: EMPTY_LINES,
  server_qty: "",
  rack_qty: "",
  server_wh_delivery_done: "",
  server_wh_delivery_date: "",
  rack_wh_delivery_done: "",
  rack_wh_delivery_date: "",
  pdu_wh_delivery_done: "",
  pdu_wh_delivery_date: "",
  scm_progress_status: "",
  scm_attachment_name: "",
  scm_remarks: "",
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

export function SiteScmFormPage({ projectId }: { projectId: string }) {
  const stageFormMeta = useSiteStageFormReadOnlyMeta();

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
        cable_lines: serializeTypeQtyLines(
          linesFromMaterial(site.cable_lines, CABLE_TYPES),
        ),
        socket_lines: serializeTypeQtyLines(
          linesFromMaterial(site.industrial_socket_lines, INDUSTRIAL_SOCKET_TYPES),
        ),
        lug_lines: serializeTypeQtyLines(
          linesFromMaterial(site.lug_lines, LUG_TYPES),
        ),
        server_qty: site.server_qty != null ? String(site.server_qty) : "",
        rack_qty: site.rack_qty != null ? String(site.rack_qty) : "",
        server_wh_delivery_done: site.server_wh_delivery_date ? "true" : "false",
        server_wh_delivery_date: dateOrEmpty(site.server_wh_delivery_date),
        rack_wh_delivery_done: site.rack_wh_delivery_date ? "true" : "false",
        rack_wh_delivery_date: dateOrEmpty(site.rack_wh_delivery_date),
        pdu_wh_delivery_done: site.pdu_wh_delivery_date ? "true" : "false",
        pdu_wh_delivery_date: dateOrEmpty(site.pdu_wh_delivery_date),
        scm_progress_status: site.scm_progress_status ?? "",
        scm_attachment_name: site.scm_attachment_name ?? "",
        scm_remarks: site.scm_remarks ?? "",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const rack = isRack(v);
      const server = isServer(v);

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
        server_wh_delivery_date:
          server && asBool(v.server_wh_delivery_done)
            ? orNull(v.server_wh_delivery_date)
            : null,
        rack_wh_delivery_date:
          rack && asBool(v.rack_wh_delivery_done) ? orNull(v.rack_wh_delivery_date) : null,
        pdu_wh_delivery_date: asBool(v.pdu_wh_delivery_done)
          ? orNull(v.pdu_wh_delivery_date)
          : null,
        scm_progress_status: orNull(v.scm_progress_status),
        scm_attachment_name: orNull(v.scm_attachment_name),
        scm_remarks: orNull(v.scm_remarks),
      });

      if (isProgressCompleteForAdvance(v.scm_progress_status)) {
        let site = await getSiteInstallationByProject(projectId);
        if (site.workflow_stage === "survey") {
          site = await advanceSiteInstallation(projectId, "complete_survey");
        }
        if (site.workflow_stage === "scm") {
          await advanceSiteInstallation(projectId, "complete_scm");
        }
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
          "Types and quantities come from Survey (read-only). Mark Yes/No and enter the delivery date when Yes.",
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
        title: "Warehouse delivery",
        subtitle: "Mark Yes/No for each WH delivery; enter the date when Yes.",
        icon: Warehouse,
        fields: [
          {
            name: "server_wh_delivery_done",
            label: "Server WH Delivery",
            type: "yesno",
            clearFieldsOnChange: ["server_wh_delivery_date"],
            visibleWhen: isServer,
          },
          {
            name: "server_wh_delivery_date",
            label: "Server WH Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => isServer(v) && v.server_wh_delivery_done === "true",
          },
          {
            name: "rack_wh_delivery_done",
            label: "Rack WH Delivery",
            type: "yesno",
            clearFieldsOnChange: ["rack_wh_delivery_date"],
            visibleWhen: isRack,
          },
          {
            name: "rack_wh_delivery_date",
            label: "Rack WH Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => isRack(v) && v.rack_wh_delivery_done === "true",
          },
          {
            name: "pdu_wh_delivery_done",
            label: "PDU WH Delivery",
            type: "yesno",
            clearFieldsOnChange: ["pdu_wh_delivery_date"],
          },
          {
            name: "pdu_wh_delivery_date",
            label: "PDU WH Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.pdu_wh_delivery_done === "true",
          },
        ],
      },
      ...stageClosingSections(
        "scm_progress_status",
        "scm_attachment_name",
        "scm_remarks",
        "SCM / Logistics",
      ),
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="SCM / Logistics"
      description="Step 3 — Site materials, quantities, and warehouse delivery. Next: Onsite Delivery, then Material Handover."
      backHref={
        stageFormMeta.readOnly
          ? (stageFormMeta.backHref ?? `/projects/projects/${projectId}`)
          : `/projects/my-jobs`
      }
      backLabel={
        stageFormMeta.readOnly
          ? (stageFormMeta.backLabel ?? "Back")
          : "Back to My Jobs"
      }
      readOnly={stageFormMeta.readOnly}
      readOnlyBanner={stageFormMeta.readOnlyBanner}
      submitLabel="Save"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
      headerActions={
        stageFormMeta.readOnly ? (
          <SiteStageExportButton projectId={projectId} stage="scm" />
        ) : null
      }
    />
  );
}
