/**
 * GRC workspace config — aligned with FRD-20 / ERD_19
 * and apps/api grc routers (Risk → CAPA).
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  FileCheck2,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type GrcWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type GrcPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "risk-registers"
    | "risk-assessments"
    | "controls"
    | "compliance-assessments"
    | "audits"
    | "corrective-actions";
};

export const GRC_MODULE_KEY = "grc";

export const grcWorkspaceGroups: GrcWorkspaceGroup[] = [
  {
    key: "policy",
    title: "Policy & Controls",
    description: "Policies, versions, controls, and control tests",
    icon: FileCheck2,
    resourceKeys: ["policies", "policy-versions", "controls", "control-tests"],
  },
  {
    key: "risk",
    title: "Risk & Compliance",
    description: "Risk register, assessments, treatments, and frameworks",
    icon: ShieldAlert,
    resourceKeys: [
      "risk-categories",
      "risk-registers",
      "risk-assessments",
      "risk-treatments",
      "compliance-frameworks",
      "compliance-assessments",
    ],
  },
  {
    key: "audit",
    title: "Audit & Remediation",
    description: "Audit plans, findings, CAPA, exceptions, and incidents",
    icon: ClipboardCheck,
    resourceKeys: [
      "audit-plans",
      "audits",
      "audit-findings",
      "corrective-actions",
      "exceptions",
      "incidents",
    ],
  },
];

/** FRD-20 §3 GRC lifecycle (core operational stages) */
export const grcPipelineStages: GrcPipelineStage[] = [
  {
    key: "risk",
    title: "Risk",
    href: "/grc/risk-registers",
    resource: "risk-registers",
  },
  {
    key: "assessment",
    title: "Assessment",
    href: "/grc/risk-assessments",
    resource: "risk-assessments",
  },
  {
    key: "control",
    title: "Control",
    href: "/grc/controls",
    resource: "controls",
  },
  {
    key: "compliance",
    title: "Compliance",
    href: "/grc/compliance-assessments",
    resource: "compliance-assessments",
  },
  {
    key: "audit",
    title: "Audit",
    href: "/grc/audits",
    resource: "audits",
  },
  {
    key: "capa",
    title: "CAPA",
    href: "/grc/corrective-actions",
    resource: "corrective-actions",
  },
];

export function getGrcResources(): ModuleResource[] {
  return getModule(GRC_MODULE_KEY)?.resources ?? [];
}

export function resolveGrcGroupResources(
  group: GrcWorkspaceGroup,
): ModuleResource[] {
  const all = getGrcResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const grcQuickLinks = [
  {
    title: "Risks",
    href: "/grc/risk-registers",
    description: "Enterprise risk register",
    icon: ShieldAlert,
  },
  {
    title: "Controls",
    href: "/grc/controls",
    description: "Internal controls",
    icon: ShieldCheck,
  },
  {
    title: "Audits",
    href: "/grc/audits",
    description: "Audit engagements",
    icon: ClipboardCheck,
  },
  {
    title: "CAPA",
    href: "/grc/corrective-actions",
    description: "Corrective actions",
    icon: TriangleAlert,
  },
] as const;

export const grcIcons = {
  Scale,
  FileCheck2,
} as const;
