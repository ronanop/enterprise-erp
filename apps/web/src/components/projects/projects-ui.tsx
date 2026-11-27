/**
 * Projects names for the shared workspace kit (`components/shared`).
 * Section / list muted subtitles are suppressed module-wide — titles only.
 */

import type { ComponentProps } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { WorkspaceSection } from "@/components/shared/workspace-ui";

export {
  ActivityTile as ProjectsActivityTile,
  CountBadge as ProjectsCountBadge,
  DetailGrid as ProjectsDetailGrid,
  DetailItem as ProjectsDetailItem,
  HeadlineBand as ProjectsHeadlineBand,
  HeadlineStat as ProjectsHeadlineStat,
  IconBadge as ProjectsIconBadge,
  InfoBanner as ProjectsInfoBanner,
  ListPanel as ProjectsListPanel,
  Metric as ProjectsMetric,
  MetricStrip as ProjectsMetricStrip,
  ViewAllLink as ProjectsViewAllLink,
  WarnBanner as ProjectsWarnBanner,
  WorkspacePage as ProjectsPage,
} from "@/components/shared/workspace-ui";

export { KpiCard as ProjectsKpiCard, KpiStrip as ProjectsKpiStrip } from "@/components/shared/kpi-card";
export { ErrorBanner as ProjectsErrorBanner } from "@/components/shared/error-banner";

export {
  CrmPipelineBarChart as ProjectsCountBarChart,
  CrmRevenueBarChart as ProjectsValueBarChart,
  CrmStageDonutChart as ProjectsDonutChart,
  CRM_CHART_COLORS as PROJECTS_CHART_COLORS,
} from "@/components/crm/crm-dashboard-charts";

export {
  SortableTh as ProjectsSortableTh,
  sortRows,
  useTableSort,
  type SortDir,
  type SortValue,
} from "@/components/shared/table-sort";

/** Projects page headers — title only (no muted description). */
export function ProjectsPageHeader({
  description: _description,
  ...props
}: ComponentProps<typeof PageHeader>) {
  return <PageHeader {...props} />;
}

/** Projects section cards — title only (no muted subtitle under the heading). */
export function ProjectsSection({
  subtitle: _subtitle,
  ...props
}: ComponentProps<typeof WorkspaceSection>) {
  return <WorkspaceSection {...props} />;
}

/** Projects list toolbars — title only (no muted panel subtitle). */
export function ProjectsListToolbar({
  subtitle: _subtitle,
  ...props
}: ComponentProps<typeof ListToolbar>) {
  return <ListToolbar {...props} />;
}
