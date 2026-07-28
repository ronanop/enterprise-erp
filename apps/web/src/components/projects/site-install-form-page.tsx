"use client";

import { useCallback, useMemo, useState } from "react";
import { Server } from "lucide-react";

import {
  deliveryIsRackOnly,
} from "@/components/projects/projects-domain";
import {
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

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "server_os_rack",
  rack_server_stacking_done: "false",
  rack_server_power_on_done: "false",
  dac_ilo_cabling_done: "false",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

export function SiteInstallFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const isRackOnly = deliveryIsRackOnly(deliveryType);

  const load = useCallback(async () => {
    const [project, site] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
    ]);
    setDeliveryType(site.delivery_type || "server_os_rack");

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: site.delivery_type || "server_os_rack",
        rack_server_stacking_done: site.rack_server_stacking_done ? "true" : "false",
        rack_server_power_on_done: site.rack_server_power_on_done ? "true" : "false",
        dac_ilo_cabling_done: site.dac_ilo_cabling_done ? "true" : "false",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      const rackOnly = deliveryIsRackOnly(type);
      await updateSiteInstallationByProject(projectId, {
        rack_server_stacking_done: asBool(v.rack_server_stacking_done),
        rack_server_power_on_done: rackOnly ? false : asBool(v.rack_server_power_on_done),
        dac_ilo_cabling_done: rackOnly ? false : asBool(v.dac_ilo_cabling_done),
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "scm") {
        site = await advanceSiteInstallation(projectId, "complete_scm");
      }
      if (site.workflow_stage === "installation") {
        const action = deliveryIsRackOnly(site.delivery_type)
          ? "complete_installation_rack_only"
          : "complete_installation";
        await advanceSiteInstallation(projectId, action);
      }

      const after = await getSiteInstallationByProject(projectId);
      if (after.workflow_stage === "configuration") {
        return `/projects/projects/${projectId}/configuration`;
      }
      if (after.workflow_stage === "acceptance") {
        return `/projects/projects/${projectId}/acceptance`;
      }
      return `/projects/projects/${projectId}`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const fields: FormSection["fields"] = [
      { name: "project_label", label: "Project", type: "readonly" },
      { name: "site_name", label: "Site", type: "readonly" },
      {
        name: "rack_server_stacking_done",
        label: isRackOnly ? "Rack Installation" : "Rack Installation + Server Stacking",
        type: "checkbox",
        required: true,
      },
    ];

    if (!isRackOnly) {
      fields.push(
        {
          name: "rack_server_power_on_done",
          label: "Rack + Server Power On",
          type: "checkbox",
          required: true,
        },
        {
          name: "dac_ilo_cabling_done",
          label: "DAC / ILO Cabling",
          type: "checkbox",
          required: true,
        },
      );
    }

    return [
      {
        title: "Installation",
        subtitle: isRackOnly
          ? "Step 4 — Rack Installation only → next is Handover to Cloud"
          : "Step 4 — Rack + stacking · Power on · DAC/ILO. Next: Configuration.",
        icon: Server,
        fields,
      },
    ];
  }, [isRackOnly]);

  return (
    <ProjectsRecordForm
      title="Installation"
      description={
        isRackOnly
          ? "Step 4 — Rack Installation only: confirm rack installation, then continue to handover."
          : "Step 4 — Confirm rack installation + server stacking, power on, and DAC/ILO cabling."
      }
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete Installation"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
