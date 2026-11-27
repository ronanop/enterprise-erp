"use client";

import { useCallback, useMemo } from "react";
import { Package } from "lucide-react";

import {
  cloudPoLinesFullyDelivered,
  draftsFromCloudPoLines,
  draftsToCloudPoLines,
  parseCloudPoDeliveryDrafts,
  serializeCloudPoDeliveryDrafts,
} from "@/components/projects/cloud-po-delivery-lines";
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
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";
import {
  isProgressCompleteForAdvance,
  stageClosingSections,
} from "@/components/projects/site-stage-attachment";
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
  cloud_po_lines: "[]",
  scm_progress_status: "",
  scm_attachment_name: "",
  scm_remarks: "",
};

function isRack(values: FormValues): boolean {
  return deliveryIncludesRack(values.delivery_type);
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
        cloud_po_lines: serializeCloudPoDeliveryDrafts(draftsFromCloudPoLines(site)),
        scm_progress_status: site.scm_progress_status ?? "",
        scm_attachment_name: site.scm_attachment_name ?? "",
        scm_remarks: site.scm_remarks ?? "",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const rack = isRack(v);
      const poLines = draftsToCloudPoLines(parseCloudPoDeliveryDrafts(v.cloud_po_lines));
      const fullyDelivered = cloudPoLinesFullyDelivered(
        parseCloudPoDeliveryDrafts(v.cloud_po_lines),
      );

      if (isProgressCompleteForAdvance(v.scm_progress_status) && !fullyDelivered) {
        throw new Error(
          "Cannot mark SCM Completed until every type quantity is fully delivered. Use Partial completed so the next stage can still be assigned.",
        );
      }

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
        cloud_po_lines: poLines,
        scm_progress_status: orNull(v.scm_progress_status),
        scm_attachment_name: orNull(v.scm_attachment_name),
        scm_remarks: orNull(v.scm_remarks),
      });

      if (isProgressCompleteForAdvance(v.scm_progress_status) && fullyDelivered) {
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
        title: "Types, quantities & site materials",
        subtitle:
          "Enter delivered qty for each PO type (remaining is calculated). Site materials come from Survey — mark Yes/No and the delivery date when Yes. SCM can only be Completed when remaining is 0 for every PO line; use Partial completed to unlock the next stage sooner.",
        icon: Package,
        fields: [
          {
            name: "cloud_po_lines",
            label: "Type / Qty delivery",
            type: "cloud_po_lines",
            full: true,
          },
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
      description="Step 3 - Types/quantities and site materials delivery. Next: Onsite Delivery."
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
