"use client";

import { useCallback, useMemo, useRef } from "react";
import { Truck, Warehouse } from "lucide-react";

import {
  deliveryIncludesRack,
  deliveryIncludesServer,
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

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  stage_assignee_label: "",
  mo_request: "",
  mo_request_date: "",
  server_on_site_delivery_done: "",
  server_on_site_delivery_date: "",
  rack_on_site_delivery_done: "",
  rack_on_site_delivery_date: "",
  pdu_on_site_delivery_done: "",
  pdu_on_site_delivery_date: "",
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

function isServer(values: FormValues): boolean {
  return deliveryIncludesServer(values.delivery_type);
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
      mo_request: site.mo_request ? "true" : "",
      mo_request_date: dateOrEmpty(site.mo_request_date),
      server_on_site_delivery_done: site.server_on_site_delivery_date ? "true" : "false",
      server_on_site_delivery_date: dateOrEmpty(site.server_on_site_delivery_date),
      rack_on_site_delivery_done: site.rack_on_site_delivery_date ? "true" : "false",
      rack_on_site_delivery_date: dateOrEmpty(site.rack_on_site_delivery_date),
      pdu_on_site_delivery_done: site.pdu_on_site_delivery_date ? "true" : "false",
      pdu_on_site_delivery_date: dateOrEmpty(site.pdu_on_site_delivery_date),
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
      const server = isServer(v);
      const rack = isRack(v);

      await updateSiteInstallationByProject(projectId, {
        mo_request: asBool(v.mo_request),
        mo_request_date: asBool(v.mo_request) ? orNull(v.mo_request_date) : null,
        server_on_site_delivery_date:
          server && asBool(v.server_on_site_delivery_done)
            ? orNull(v.server_on_site_delivery_date)
            : null,
        rack_on_site_delivery_date:
          rack && asBool(v.rack_on_site_delivery_done)
            ? orNull(v.rack_on_site_delivery_date)
            : null,
        pdu_on_site_delivery_date: asBool(v.pdu_on_site_delivery_done)
          ? orNull(v.pdu_on_site_delivery_date)
          : null,
        onsite_delivery_progress_status: orNull(v.onsite_delivery_progress_status),
        onsite_delivery_attachment_name: orNull(v.onsite_delivery_attachment_name),
        onsite_delivery_remarks: orNull(v.onsite_delivery_remarks),
      });

      loadedValuesRef.current = v;

      if (isProgressCompleteForAdvance(v.onsite_delivery_progress_status)) {
        let site = await getSiteInstallationByProject(projectId);
        if (site.workflow_stage === "survey") {
          site = await advanceSiteInstallation(projectId, "complete_survey");
        }
        if (site.workflow_stage === "scm") {
          site = await advanceSiteInstallation(projectId, "complete_scm");
        }
        if (
          site.workflow_stage === "onsite_delivery" ||
          site.workflow_stage === "onsite"
        ) {
          await advanceSiteInstallation(projectId, "complete_onsite_delivery");
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
            visibleWhen: (v) => v.mo_request === "true",
          },
        ],
      },
      {
        title: "On-site deliveries",
        subtitle: "Mark Yes/No for each on-site delivery; enter the date when Yes.",
        icon: Warehouse,
        fields: [
          {
            name: "server_on_site_delivery_done",
            label: "Server On-site Delivery",
            type: "yesno",
            clearFieldsOnChange: ["server_on_site_delivery_date"],
            visibleWhen: isServer,
          },
          {
            name: "server_on_site_delivery_date",
            label: "Server On-site Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => isServer(v) && v.server_on_site_delivery_done === "true",
          },
          {
            name: "rack_on_site_delivery_done",
            label: "Rack On-site Delivery",
            type: "yesno",
            clearFieldsOnChange: ["rack_on_site_delivery_date"],
            visibleWhen: isRack,
          },
          {
            name: "rack_on_site_delivery_date",
            label: "Rack On-site Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => isRack(v) && v.rack_on_site_delivery_done === "true",
          },
          {
            name: "pdu_on_site_delivery_done",
            label: "PDU On-site Delivery",
            type: "yesno",
            clearFieldsOnChange: ["pdu_on_site_delivery_date"],
          },
          {
            name: "pdu_on_site_delivery_date",
            label: "PDU On-site Delivery Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.pdu_on_site_delivery_done === "true",
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
      description="Step 4 — MO request and on-site deliveries (server / rack / PDU)."
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
