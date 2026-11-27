"use client";

import { useCallback, useMemo, useRef } from "react";
import { Package, Truck } from "lucide-react";

import {
  cloudPoLinesFullyDeliveredOnsite,
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
  dateIfAnswered,
  orNull,
  ProjectsRecordForm,
  yesNoFromBoolDate,
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
  mo_request: "",
  mo_request_date: "",
  cloud_po_lines: "[]",
  cable_lines: EMPTY_LINES,
  socket_lines: EMPTY_LINES,
  lug_lines: EMPTY_LINES,
  onsite_delivery_progress_status: "",
  onsite_delivery_attachment_name: "",
  onsite_delivery_remarks: "",
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

export function SiteOnsiteDeliveryFormPage({ projectId }: { projectId: string }) {
  const stageFormMeta = useSiteStageFormReadOnlyMeta();
  const loadedValuesRef = useRef<FormValues | null>(null);

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const owner = resolveStageOwnerDisplay(site, "onsite_delivery", lookups.employees);

    const values = {
      ...intakeSummaryValues({
        project,
        site,
        branches: lookups.branches,
        customers: lookups.customers,
        employees: lookups.employees,
      }),
      delivery_type: site.delivery_type ?? "",
      stage_assignee_label: owner.stage_assignee_label,
      mo_request: yesNoFromBoolDate(site.mo_request, site.mo_request_date),
      mo_request_date: dateOrEmpty(site.mo_request_date),
      cloud_po_lines: serializeCloudPoDeliveryDrafts(draftsFromCloudPoLines(site)),
      cable_lines: serializeTypeQtyLines(
        linesFromMaterial(site.cable_lines, CABLE_TYPES),
      ),
      socket_lines: serializeTypeQtyLines(
        linesFromMaterial(site.industrial_socket_lines, INDUSTRIAL_SOCKET_TYPES),
      ),
      lug_lines: serializeTypeQtyLines(
        linesFromMaterial(site.lug_lines, LUG_TYPES),
      ),
      onsite_delivery_progress_status:
        site.onsite_delivery_progress_status ?? site.onsite_progress_status ?? "",
      onsite_delivery_attachment_name:
        site.onsite_delivery_attachment_name ?? site.onsite_attachment_name ?? "",
      onsite_delivery_remarks: site.onsite_delivery_remarks ?? site.onsite_remarks ?? "",
    } satisfies FormValues;
    loadedValuesRef.current = values;
    return { values };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const drafts = parseCloudPoDeliveryDrafts(v.cloud_po_lines);
      const fullyOnsite = cloudPoLinesFullyDeliveredOnsite(drafts);
      const rack = isRack(v);

      if (isProgressCompleteForAdvance(v.onsite_delivery_progress_status) && !fullyOnsite) {
        throw new Error(
          "Cannot mark Onsite Delivery Completed until every PO quantity is received on site. Use Partial completed so the next stage can still be assigned.",
        );
      }

      await updateSiteInstallationByProject(projectId, {
        mo_request: asBool(v.mo_request),
        mo_request_date: dateIfAnswered(v.mo_request, v.mo_request_date),
        cloud_po_lines: draftsToCloudPoLines(drafts),
        ...(rack
          ? {
              cable_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.cable_lines)),
              industrial_socket_lines: typeQtyLinesToMaterial(
                parseTypeQtyLines(v.socket_lines),
              ),
              lug_lines: typeQtyLinesToMaterial(parseTypeQtyLines(v.lug_lines)),
            }
          : {}),
        onsite_delivery_progress_status: orNull(v.onsite_delivery_progress_status),
        onsite_delivery_attachment_name: orNull(v.onsite_delivery_attachment_name),
        onsite_delivery_remarks: orNull(v.onsite_delivery_remarks),
      });

      loadedValuesRef.current = v;

      if (isProgressCompleteForAdvance(v.onsite_delivery_progress_status) && fullyOnsite) {
        await advanceSiteInstallation(projectId, "complete_onsite_delivery");
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
        title: "Material order",
        subtitle: "Raise the MO and confirm it was placed.",
        icon: Truck,
        fields: [
          {
            name: "mo_request",
            label: "MO Request",
            type: "yesno",
            clearFieldsOnChange: ["mo_request_date"],
          },
          {
            name: "mo_request_date",
            label: "MO Request Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.mo_request === "true" || v.mo_request === "false",
          },
        ],
      },
      {
        title: "On-site types & quantities",
        icon: Package,
        fields: [
          {
            name: "cloud_po_lines",
            label: "Type / Qty onsite delivery",
            type: "cloud_po_lines",
            deliveryMode: "onsite",
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
        "onsite_delivery_progress_status",
        "onsite_delivery_attachment_name",
        "onsite_delivery_remarks",
        "Onsite Delivery",
      ),
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="Onsite Delivery"
      description="Step 4 - MO request and on-site receipt of all PO quantities and site materials."
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
          <SiteStageExportButton projectId={projectId} stage="onsite_delivery" />
        ) : null
      }
    />
  );
}
