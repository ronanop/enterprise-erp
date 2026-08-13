"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

import {
  deliveryIncludesOs,
  deliveryIsRackOnly,
  deliveryNeedsHwat,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  orNull,
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
  notifySiteStageNoAnswers,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";
import {
  collectNewNoAnswers,
  isProgressCompleteForAdvance,
  stageClosingSections,
} from "@/components/projects/site-stage-attachment";
import { useSiteStageFormReadOnlyMeta } from "@/components/projects/site-stage-form-read-only-context";

const ACCEPTANCE_NO_FIELDS = [
  { name: "handover_to_cloud_done", label: "Handover to Application Team" },
  { name: "hwat_request_done", label: "HWAT Request" },
  { name: "hwat_signoff_received", label: "HWAT Sign-off from Circle" },
] as const;

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "server_os_rack",
  stage_assignee_label: "",
  os_installation_done: "",
  mbss_done: "",
  vascan_done: "",
  handover_to_cloud_done: "",
  handover_to_cloud_date: "",
  hwat_request_done: "",
  hwat_request_date: "",
  hwat_signoff_received: "",
  hwat_signoff_date: "",
  acceptance_progress_status: "",
  acceptance_attachment_name: "",
  acceptance_remarks: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function SiteAcceptanceFormPage({ projectId }: { projectId: string }) {
  const stageFormMeta = useSiteStageFormReadOnlyMeta();
  const loadedValuesRef = useRef<FormValues | null>(null);
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const needsHwat = deliveryNeedsHwat(deliveryType);
  const showOsStatus = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const type = site.delivery_type || "server_os_rack";
    setDeliveryType(type);
    const owner = resolveStageOwnerDisplay(site, "acceptance", lookups.employees);

    const values = {
      ...intakeSummaryValues({
        project,
        site,
        branches: lookups.branches,
        customers: lookups.customers,
        employees: lookups.employees,
      }),
      stage_assignee_label: owner.stage_assignee_label,
      delivery_type: type,
      os_installation_done: site.os_installation_done ? "Done" : "Pending",
      mbss_done: site.mbss_done ? "Done" : "Pending",
      vascan_done: site.vascan_done ? "Done" : "Pending",
      handover_to_cloud_done: site.handover_to_cloud_done ? "true" : "",
      handover_to_cloud_date: dateOrEmpty(site.handover_to_cloud_date),
      hwat_request_done: site.hwat_request_done ? "true" : "",
      hwat_request_date: dateOrEmpty(site.hwat_request_date),
      hwat_signoff_received: site.hwat_signoff_received ? "true" : "",
      hwat_signoff_date: dateOrEmpty(site.hwat_signoff_date),
      acceptance_progress_status: site.acceptance_progress_status ?? "",
      acceptance_attachment_name: site.acceptance_attachment_name ?? "",
      acceptance_remarks: site.acceptance_remarks ?? "",
    } satisfies FormValues;
    loadedValuesRef.current = values;
    return { values };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      const rackOnly = deliveryIsRackOnly(type);
      const hwat = !rackOnly && deliveryNeedsHwat(type);

      await updateSiteInstallationByProject(projectId, {
        handover_to_cloud_done: asBool(v.handover_to_cloud_done),
        handover_to_cloud_date: asBool(v.handover_to_cloud_done)
          ? orNull(v.handover_to_cloud_date)
          : null,
        hwat_request_done: hwat ? asBool(v.hwat_request_done) : false,
        hwat_request_date: hwat && asBool(v.hwat_request_done) ? orNull(v.hwat_request_date) : null,
        hwat_signoff_received: hwat ? asBool(v.hwat_signoff_received) : false,
        hwat_signoff_date:
          hwat && asBool(v.hwat_signoff_received) ? orNull(v.hwat_signoff_date) : null,
        acceptance_progress_status: orNull(v.acceptance_progress_status),
        acceptance_attachment_name: orNull(v.acceptance_attachment_name),
        acceptance_remarks: orNull(v.acceptance_remarks),
      });

      const activeHwatFields = hwat
        ? [...ACCEPTANCE_NO_FIELDS]
        : ACCEPTANCE_NO_FIELDS.filter(
          (f) => f.name !== "hwat_request_done" && f.name !== "hwat_signoff_received",
        );
      const noAnswers = collectNewNoAnswers(v, loadedValuesRef.current, activeHwatFields);
      if (noAnswers.length > 0) {
        await notifySiteStageNoAnswers(projectId, {
          stage: "acceptance",
          items: noAnswers,
        }).catch(() => {
          // Non-blocking.
        });
      }
      loadedValuesRef.current = v;

      if (isProgressCompleteForAdvance(v.acceptance_progress_status)) {
        let site = await getSiteInstallationByProject(projectId);
        if (site.workflow_stage === "installation") {
          site = await advanceSiteInstallation(projectId, "complete_installation");
        }
        if (site.workflow_stage === "acceptance") {
          await advanceSiteInstallation(projectId, "complete_acceptance");
        }
      }

      return `/projects/my-jobs`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const fields: FormSection["fields"] = [];

    if (showOsStatus) {
      fields.push(
        {
          name: "os_installation_done",
          label: "OS Installation (from Configuration)",
          type: "readonly",
        },
        {
          name: "mbss_done",
          label: "MBSS (from Configuration)",
          type: "readonly",
        },
        {
          name: "vascan_done",
          label: "VASCAN (from Configuration)",
          type: "readonly",
        },
      );
    }

    fields.push(
      {
        name: "handover_to_cloud_done",
        label: "Handover to Application Team",
        type: "yesno",
        hint: "Common exit for all delivery scopes.",
        clearFieldsOnChange: ["handover_to_cloud_date"],
      },
      {
        name: "handover_to_cloud_date",
        label: "Handover to Application Team Date",
        type: "date",
        required: true,
        visibleWhen: (v) => v.handover_to_cloud_done === "true",
      },
    );

    if (needsHwat) {
      fields.push(
        {
          name: "hwat_request_done",
          label: "HWAT Request",
          type: "yesno",
          clearFieldsOnChange: ["hwat_request_date"],
        },
        {
          name: "hwat_request_date",
          label: "HWAT Request Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.hwat_request_done === "true",
        },
        {
          name: "hwat_signoff_received",
          label: "HWAT Sign-off from Circle",
          type: "yesno",
          clearFieldsOnChange: ["hwat_signoff_date"],
        },
        {
          name: "hwat_signoff_date",
          label: "HWAT Sign-off Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.hwat_signoff_received === "true",
        },
      );
    }

    return [
      intakeSummarySection(),
      stageOwnerBannerSection(),
      {
        title: "Acceptance / Closure",
        subtitle: needsHwat
          ? "Step 6 — HWAT + Circle sign-off · Handover to Application Team"
          : "Step 6 — Rack handover · Handover to Application Team",
        icon: CloudUpload,
        fields,
      },
      ...stageClosingSections(
        "acceptance_progress_status",
        "acceptance_attachment_name",
        "acceptance_remarks",
        "Acceptance",
      ),
    ];
  }, [needsHwat, showOsStatus]);

  return (
    <ProjectsRecordForm
      title="Acceptance / Closure"
      description={
        needsHwat
          ? "Step 6 — Complete HWAT, Circle sign-off, and Handover to Application Team."
          : "Step 6 — Rack Installation only — complete Handover to Application Team to close."
      }
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
    />
  );
}
