/**
 * Service workspace config — aligned with FRD-16 / ERD_16
 * and apps/api service routers (Request → Contract).
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileSignature,
  Headphones,
  MapPin,
  Ticket,
  Wrench,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type ServiceWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type ServicePipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "service-requests"
    | "service-tickets"
    | "service-assignments"
    | "work-orders"
    | "service-visits"
    | "service-contracts";
};

export const SERVICE_MODULE_KEY = "service";

export const serviceWorkspaceGroups: ServiceWorkspaceGroup[] = [
  {
    key: "intake",
    title: "Catalog & Intake",
    description: "Categories, requests, and tickets",
    icon: Headphones,
    resourceKeys: ["service-categories", "service-requests", "service-tickets"],
  },
  {
    key: "execution",
    title: "Dispatch & Execution",
    description: "Assignments, schedules, WOs, tasks, visits",
    icon: Wrench,
    resourceKeys: [
      "service-assignments",
      "service-schedules",
      "work-orders",
      "service-tasks",
      "service-visits",
    ],
  },
  {
    key: "governance",
    title: "SLA & Commercial",
    description: "Materials, time, SLAs, escalations, contracts, feedback",
    icon: FileSignature,
    resourceKeys: [
      "service-materials",
      "time-entries",
      "service-slas",
      "service-escalations",
      "service-contracts",
      "service-feedback",
    ],
  },
];

/** ERD_16 service delivery lifecycle (core operational stages) */
export const servicePipelineStages: ServicePipelineStage[] = [
  {
    key: "request",
    title: "Request",
    href: "/service/service-requests",
    resource: "service-requests",
  },
  {
    key: "ticket",
    title: "Ticket",
    href: "/service/service-tickets",
    resource: "service-tickets",
  },
  {
    key: "assignment",
    title: "Assignment",
    href: "/service/service-assignments",
    resource: "service-assignments",
  },
  {
    key: "work-order",
    title: "Work Order",
    href: "/service/work-orders",
    resource: "work-orders",
  },
  {
    key: "visit",
    title: "Visit",
    href: "/service/service-visits",
    resource: "service-visits",
  },
  {
    key: "contract",
    title: "Contract",
    href: "/service/service-contracts",
    resource: "service-contracts",
  },
];

export function getServiceResources(): ModuleResource[] {
  return getModule(SERVICE_MODULE_KEY)?.resources ?? [];
}

export function resolveServiceGroupResources(
  group: ServiceWorkspaceGroup,
): ModuleResource[] {
  const all = getServiceResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const serviceQuickLinks = [
  {
    title: "Requests",
    href: "/service/service-requests",
    description: "Customer intake",
    icon: ClipboardList,
  },
  {
    title: "Tickets",
    href: "/service/service-tickets",
    description: "Queue & ownership",
    icon: Ticket,
  },
  {
    title: "Work Orders",
    href: "/service/work-orders",
    description: "Field execution",
    icon: Wrench,
  },
  {
    title: "Visits",
    href: "/service/service-visits",
    description: "On-site check-ins",
    icon: MapPin,
  },
] as const;

export const serviceIcons = {
  Headphones,
} as const;
