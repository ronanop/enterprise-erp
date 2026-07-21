/**
 * Quality workspace config — aligned with FRD-14 screen inventory
 * and apps/api quality routers (Incoming → In-Process → Final → NCR → CAPA).
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  ListChecks,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type QualityWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type QualityPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "incoming-inspections"
    | "inprocess-inspections"
    | "final-inspections"
    | "ncrs"
    | "capas";
};

export const QUALITY_MODULE_KEY = "quality";

export const qualityWorkspaceGroups: QualityWorkspaceGroup[] = [
  {
    key: "masters",
    title: "Quality Masters",
    description: "Plans, sampling, characteristics, and defect catalog",
    icon: ListChecks,
    resourceKeys: ["plans", "sampling-plans", "characteristics", "defect-types"],
  },
  {
    key: "inspections",
    title: "Inspections",
    description: "Incoming, in-process, final QC, and defect records",
    icon: ClipboardCheck,
    resourceKeys: [
      "incoming-inspections",
      "inprocess-inspections",
      "final-inspections",
      "defects",
    ],
  },
  {
    key: "assurance",
    title: "NCR, CAPA & Assurance",
    description: "Non-conformances, CAPA, suppliers, complaints, audits, scores",
    icon: ShieldCheck,
    resourceKeys: ["ncrs", "capas", "supplier-quality", "complaints", "audits", "scores"],
  },
];

/** FRD-14 quality lifecycle (core operational stages) */
export const qualityPipelineStages: QualityPipelineStage[] = [
  {
    key: "incoming",
    title: "Incoming",
    href: "/quality/incoming-inspections",
    resource: "incoming-inspections",
  },
  {
    key: "inprocess",
    title: "In-Process",
    href: "/quality/inprocess-inspections",
    resource: "inprocess-inspections",
  },
  {
    key: "final",
    title: "Final QC",
    href: "/quality/final-inspections",
    resource: "final-inspections",
  },
  { key: "ncr", title: "NCR", href: "/quality/ncrs", resource: "ncrs" },
  { key: "capa", title: "CAPA", href: "/quality/capas", resource: "capas" },
];

export function getQualityResources(): ModuleResource[] {
  return getModule(QUALITY_MODULE_KEY)?.resources ?? [];
}

export function resolveQualityGroupResources(
  group: QualityWorkspaceGroup,
): ModuleResource[] {
  const all = getQualityResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const qualityQuickLinks = [
  {
    title: "Incoming",
    href: "/quality/incoming-inspections",
    description: "IQC inspections",
    icon: ClipboardList,
  },
  {
    title: "NCRs",
    href: "/quality/ncrs",
    description: "Non-conformances",
    icon: FileWarning,
  },
  {
    title: "CAPAs",
    href: "/quality/capas",
    description: "Corrective actions",
    icon: ShieldAlert,
  },
  {
    title: "Audits",
    href: "/quality/audits",
    description: "Quality audits",
    icon: BadgeCheck,
  },
] as const;

export const qualityIcons = {
  MessageSquareWarning,
  ClipboardCheck,
} as const;
