/**
 * Analytics (BI) workspace config — aligned with FRD-18
 * and apps/api analytics routers (Dataset → Alert).
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Database,
  FileBarChart,
  LayoutDashboard,
  Target,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type AnalyticsWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type AnalyticsPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "datasets"
    | "metrics"
    | "kpis"
    | "dashboards"
    | "reports"
    | "alert-rules";
};

export const ANALYTICS_MODULE_KEY = "analytics";

export const analyticsWorkspaceGroups: AnalyticsWorkspaceGroup[] = [
  {
    key: "presentation",
    title: "Presentation",
    description: "Dashboards, widgets, reports, and schedules",
    icon: LayoutDashboard,
    resourceKeys: [
      "dashboards",
      "dashboard-widgets",
      "reports",
      "report-schedules",
    ],
  },
  {
    key: "measures",
    title: "Measures & Models",
    description: "Datasets, metrics, KPIs, and dimensions",
    icon: Database,
    resourceKeys: ["datasets", "metrics", "kpis", "dimensions"],
  },
  {
    key: "delivery",
    title: "Delivery & Data Ops",
    description: "Alerts, subscriptions, exports, and imports",
    icon: Bell,
    resourceKeys: [
      "alert-rules",
      "subscriptions",
      "data-exports",
      "data-imports",
    ],
  },
];

/** FRD-18 §3 BI architecture (core operational stages) */
export const analyticsPipelineStages: AnalyticsPipelineStage[] = [
  {
    key: "dataset",
    title: "Dataset",
    href: "/analytics/datasets",
    resource: "datasets",
  },
  {
    key: "metric",
    title: "Metric",
    href: "/analytics/metrics",
    resource: "metrics",
  },
  {
    key: "kpi",
    title: "KPI",
    href: "/analytics/kpis",
    resource: "kpis",
  },
  {
    key: "dashboard",
    title: "Dashboard",
    href: "/analytics/dashboards",
    resource: "dashboards",
  },
  {
    key: "report",
    title: "Report",
    href: "/analytics/reports",
    resource: "reports",
  },
  {
    key: "alert",
    title: "Alert",
    href: "/analytics/alert-rules",
    resource: "alert-rules",
  },
];

export function getAnalyticsResources(): ModuleResource[] {
  return getModule(ANALYTICS_MODULE_KEY)?.resources ?? [];
}

export function resolveAnalyticsGroupResources(
  group: AnalyticsWorkspaceGroup,
): ModuleResource[] {
  const all = getAnalyticsResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const analyticsQuickLinks = [
  {
    title: "Dashboards",
    href: "/analytics/dashboards",
    description: "Executive & ops views",
    icon: LayoutDashboard,
  },
  {
    title: "Reports",
    href: "/analytics/reports",
    description: "Scheduled reporting",
    icon: FileBarChart,
  },
  {
    title: "KPIs",
    href: "/analytics/kpis",
    description: "KPI engine",
    icon: Target,
  },
  {
    title: "Alerts",
    href: "/analytics/alert-rules",
    description: "Threshold monitoring",
    icon: Bell,
  },
] as const;

export const analyticsIcons = {
  BarChart3,
} as const;
