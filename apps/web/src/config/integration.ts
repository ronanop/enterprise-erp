/**
 * Integration Hub workspace config — aligned with FRD-21 / ERD_21
 * and apps/api integration routers (System → Sync).
 */

import type { LucideIcon } from "lucide-react";
import {
  Cable,
  Link2,
  Radio,
  RefreshCw,
  Server,
  Webhook,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type IntegrationWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type IntegrationPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "external-systems"
    | "connectors"
    | "webhooks"
    | "event-definitions"
    | "message-queues"
    | "sync-jobs";
};

export const INTEGRATION_MODULE_KEY = "integration";

export const integrationWorkspaceGroups: IntegrationWorkspaceGroup[] = [
  {
    key: "systems",
    title: "Systems & Security",
    description: "External systems, connectors, credentials, and OAuth",
    icon: Server,
    resourceKeys: [
      "external-systems",
      "connectors",
      "api-credentials",
      "oauth-clients",
    ],
  },
  {
    key: "messaging",
    title: "Events & Messaging",
    description: "Webhooks, events, queues, retries, and dead letters",
    icon: Radio,
    resourceKeys: [
      "webhooks",
      "event-definitions",
      "message-queues",
      "retry-queues",
      "dead-letters",
    ],
  },
  {
    key: "sync",
    title: "Transform & Ops",
    description: "Mappings, sync jobs, sync logs, and rate limits",
    icon: RefreshCw,
    resourceKeys: ["data-mappings", "sync-jobs", "sync-logs", "rate-limits"],
  },
];

/** FRD-21 §3 / ERD_21 connectivity flow (core operational stages) */
export const integrationPipelineStages: IntegrationPipelineStage[] = [
  {
    key: "system",
    title: "System",
    href: "/integration/external-systems",
    resource: "external-systems",
  },
  {
    key: "connector",
    title: "Connector",
    href: "/integration/connectors",
    resource: "connectors",
  },
  {
    key: "webhook",
    title: "Webhook",
    href: "/integration/webhooks",
    resource: "webhooks",
  },
  {
    key: "event",
    title: "Event",
    href: "/integration/event-definitions",
    resource: "event-definitions",
  },
  {
    key: "queue",
    title: "Queue",
    href: "/integration/message-queues",
    resource: "message-queues",
  },
  {
    key: "sync",
    title: "Sync",
    href: "/integration/sync-jobs",
    resource: "sync-jobs",
  },
];

export function getIntegrationResources(): ModuleResource[] {
  return getModule(INTEGRATION_MODULE_KEY)?.resources ?? [];
}

export function resolveIntegrationGroupResources(
  group: IntegrationWorkspaceGroup,
): ModuleResource[] {
  const all = getIntegrationResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const integrationQuickLinks = [
  {
    title: "Systems",
    href: "/integration/external-systems",
    description: "External endpoints",
    icon: Server,
  },
  {
    title: "Connectors",
    href: "/integration/connectors",
    description: "Protocol adapters",
    icon: Cable,
  },
  {
    title: "Webhooks",
    href: "/integration/webhooks",
    description: "Inbound / outbound",
    icon: Webhook,
  },
  {
    title: "Sync Jobs",
    href: "/integration/sync-jobs",
    description: "Push / pull runs",
    icon: RefreshCw,
  },
] as const;

export const integrationIcons = {
  Link2,
  Cable,
} as const;
