/**
 * Service workspace config — SOP request ticket workflow only.
 */

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock, Ticket } from "lucide-react";

export type ServicePipelineStage = {
  key: string;
  title: string;
  href: string;
  resource: "service-request-tickets" | "service-slas" | "resolved-tickets";
};

export const SERVICE_MODULE_KEY = "service";

/** SOP ticket lifecycle stages shown on the overview funnel */
export const servicePipelineStages: ServicePipelineStage[] = [
  {
    key: "request-ticket",
    title: "Request Tickets",
    href: "/service/service-request-tickets",
    resource: "service-request-tickets",
  },
  {
    key: "sla",
    title: "Active SLAs",
    href: "/service/service-slas",
    resource: "service-slas",
  },
  {
    key: "resolved",
    title: "Resolved",
    href: "/service/resolved-tickets",
    resource: "resolved-tickets",
  },
];

export const serviceQuickLinks = [
  {
    title: "Request Tickets",
    href: "/service/service-request-tickets",
    description: "SOP intake & tracking",
    icon: Ticket,
  },
  {
    title: "Active SLAs",
    href: "/service/service-slas",
    description: "Live ticket SLA clocks",
    icon: Clock,
  },
  {
    title: "Resolved",
    href: "/service/resolved-tickets",
    description: "Closed & resolved tickets",
    icon: CheckCircle2,
  },
] as const;

export const serviceIcons = {
  Ticket,
} as const;
