"use client";

import { useCallback, useMemo, useRef } from "react";
import { Package } from "lucide-react";

import { deliveryIsRackOnly } from "@/components/projects/projects-domain";
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

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  stage_assignee_label: "",
  im_material: "",
  im_material_date: "",
  power_on_material: "",
  power_on_material_date: "",
  material_handover_done: "",
  material_handover_date: "",
  material_handover_to_name: "",
  material_handover_progress_status: "",
  material_handover_attachment_name: "",
  material_handover_remarks: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

function isRackOnly(values: FormValues): boolean {
  return deliveryIsRackOnly(values.delivery_type);
}

export function SiteMaterialHandoverFormPage({ projectId }: { projectId: string }) {
  const stageFormMeta = useSiteStageFormReadOnlyMeta();
  const loadedValuesRef = useRef<FormValues | null>(null);

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const owner = resolveStageOwnerDisplay(site, "material_handover", lookups.employees);

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
      im_material: site.im_material ? "true" : "",
      im_material_date: dateOrEmpty(site.im_material_date),
      power_on_material: site.power_on_material ? "true" : "",
      power_on_material_date: dateOrEmpty(site.power_on_material_date),
      material_handover_done: site.material_handover_done ? "true" : "",
      material_handover_date: dateOrEmpty(site.material_handover_date),
      material_handover_to_name: site.material_handover_to_name ?? "",
      material_handover_progress_status: site.material_handover_progress_status ?? "",
      material_handover_attachment_name: site.material_handover_attachment_name ?? "",
      material_handover_remarks: site.material_handover_remarks ?? "",
    } satisfies FormValues;
    loadedValuesRef.current = values;
    return { values };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const rackOnly = isRackOnly(v);

      await updateSiteInstallationByProject(projectId, {
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
        material_handover_to_name: asBool(v.material_handover_done)
          ? orNull(v.material_handover_to_name)
          : null,
        material_handover_progress_status: orNull(v.material_handover_progress_status),
        material_handover_attachment_name: orNull(v.material_handover_attachment_name),
        material_handover_remarks: orNull(v.material_handover_remarks),
      });

      loadedValuesRef.current = v;

      if (isProgressCompleteForAdvance(v.material_handover_progress_status)) {
        let site = await getSiteInstallationByProject(projectId);
        if (site.workflow_stage === "onsite_delivery") {
          site = await advanceSiteInstallation(projectId, "complete_onsite_delivery");
        }
        if (
          site.workflow_stage === "material_handover" ||
          site.workflow_stage === "onsite"
        ) {
          await advanceSiteInstallation(projectId, "complete_material_handover");
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
        title: "IM material & handover",
        subtitle: "Confirm IM material and warehouse-to-site handover.",
        icon: Package,
        fields: [
          {
            name: "im_material",
            label: "IM Material",
            type: "yesno",
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
            type: "yesno",
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
            type: "yesno",
            clearFieldsOnChange: ["material_handover_date", "material_handover_to_name"],
          },
          {
            name: "material_handover_date",
            label: "Material Handover Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.material_handover_done === "true",
          },
          {
            name: "material_handover_to_name",
            label: "Handed Over To (Name)",
            type: "text",
            required: true,
            placeholder: "Person who received the materials",
            visibleWhen: (v) => v.material_handover_done === "true",
          },
        ],
      },
      ...stageClosingSections(
        "material_handover_progress_status",
        "material_handover_attachment_name",
        "material_handover_remarks",
        "Material Handover",
      ),
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="Material Handover"
      description="Step 5 — IM material, power-on material, and WH → site handover."
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
          <SiteStageExportButton projectId={projectId} stage="material_handover" />
        ) : null
      }
    />
  );
}
