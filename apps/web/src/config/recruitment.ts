/**
 * Recruitment workspace config — aligned with FRD-09 §§4–8 / ERD_13
 * and apps/api recruitment routers (Requisition → Onboarding).
 */

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardList,
  FileCheck2,
  Handshake,
  UserRoundSearch,
  Users,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type RecruitmentWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type RecruitmentPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "job-requisitions"
    | "job-postings"
    | "applications"
    | "interviews"
    | "offers"
    | "onboarding";
};

export const RECRUITMENT_MODULE_KEY = "recruitment";

export const recruitmentWorkspaceGroups: RecruitmentWorkspaceGroup[] = [
  {
    key: "sourcing",
    title: "Requisitions & Sourcing",
    description: "Openings, postings, sources, and recruiters",
    icon: Briefcase,
    resourceKeys: [
      "job-requisitions",
      "job-postings",
      "recruitment-sources",
      "recruiters",
    ],
  },
  {
    key: "pipeline",
    title: "Candidate Pipeline",
    description: "Candidates, applications, stages, and talent pools",
    icon: Users,
    resourceKeys: [
      "candidates",
      "applications",
      "application-stages",
      "talent-pools",
    ],
  },
  {
    key: "hire",
    title: "Interview, Offer & Onboard",
    description: "Interviews, feedback, offers, BGV, and onboarding",
    icon: Handshake,
    resourceKeys: [
      "interviews",
      "interview-feedback",
      "offers",
      "background-verifications",
      "onboarding",
      "onboarding-tasks",
    ],
  },
];

/** ERD_13 hire-to-onboard funnel (core operational stages) */
export const recruitmentPipelineStages: RecruitmentPipelineStage[] = [
  {
    key: "requisition",
    title: "Requisition",
    href: "/recruitment/job-requisitions",
    resource: "job-requisitions",
  },
  {
    key: "posting",
    title: "Posting",
    href: "/recruitment/job-postings",
    resource: "job-postings",
  },
  {
    key: "application",
    title: "Application",
    href: "/recruitment/applications",
    resource: "applications",
  },
  {
    key: "interview",
    title: "Interview",
    href: "/recruitment/interviews",
    resource: "interviews",
  },
  {
    key: "offer",
    title: "Offer",
    href: "/recruitment/offers",
    resource: "offers",
  },
  {
    key: "onboarding",
    title: "Onboarding",
    href: "/recruitment/onboarding",
    resource: "onboarding",
  },
];

export function getRecruitmentResources(): ModuleResource[] {
  return getModule(RECRUITMENT_MODULE_KEY)?.resources ?? [];
}

export function resolveRecruitmentGroupResources(
  group: RecruitmentWorkspaceGroup,
): ModuleResource[] {
  const all = getRecruitmentResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const recruitmentQuickLinks = [
  {
    title: "Requisitions",
    href: "/recruitment/job-requisitions",
    description: "Hiring openings",
    icon: ClipboardList,
  },
  {
    title: "Candidates",
    href: "/recruitment/candidates",
    description: "Talent master",
    icon: UserRoundSearch,
  },
  {
    title: "Interviews",
    href: "/recruitment/interviews",
    description: "Schedule & feedback",
    icon: Users,
  },
  {
    title: "Offers",
    href: "/recruitment/offers",
    description: "Compensation offers",
    icon: FileCheck2,
  },
] as const;

export const recruitmentIcons = {
  Briefcase,
} as const;
