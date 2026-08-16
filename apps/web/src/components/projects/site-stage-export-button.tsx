"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { loadIntakeSummaryLookups } from "@/components/projects/site-intake-summary";
import {
  getProject,
  getSiteInstallationBlueprint,
  getSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  exportProjectStageExcel,
  exportWholeProjectExcel,
} from "@/utils/project-excel-export";

export function SiteStageExportButton({
  projectId,
  stage,
}: {
  projectId: string;
  stage: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer transition-colors duration-200"
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const [project, site, blueprint, lookups] = await Promise.all([
              getProject(projectId),
              getSiteInstallationByProject(projectId),
              getSiteInstallationBlueprint(projectId).catch(() => null),
              loadIntakeSummaryLookups(),
            ]);
            const employeeNames = Object.fromEntries(
              lookups.employees.map((e) => [e.id, e.label]),
            );
            await exportProjectStageExcel({
              project,
              site,
              stage,
              blueprint,
              employeeNames,
            });
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <Download className="size-3.5" />
      {busy ? "Exporting…" : "Export"}
    </Button>
  );
}

export function ProjectExcelExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer transition-colors duration-200"
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const [project, site, blueprint, lookups] = await Promise.all([
              getProject(projectId),
              getSiteInstallationByProject(projectId),
              getSiteInstallationBlueprint(projectId).catch(() => null),
              loadIntakeSummaryLookups(),
            ]);
            const employeeNames = Object.fromEntries(
              lookups.employees.map((e) => [e.id, e.label]),
            );
            await exportWholeProjectExcel({
              project,
              site,
              blueprint,
              employeeNames,
            });
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <Download className="size-3.5" />
      {busy ? "Exporting…" : "Export Excel"}
    </Button>
  );
}
