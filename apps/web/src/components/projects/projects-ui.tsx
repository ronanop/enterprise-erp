/**
 * Projects portal UI primitives.
 *
 * The dashboard shell primitives are shared verbatim with the CRM portal so
 * both portals stay visually identical; they are re-exported under `Projects*`
 * names so portal code reads in its own domain language.
 */

export {
  CrmActivityTile as ProjectsActivityTile,
  CrmCountBadge as ProjectsCountBadge,
  CrmDetailGrid as ProjectsDetailGrid,
  CrmDetailItem as ProjectsDetailItem,
  CrmErrorBanner as ProjectsErrorBanner,
  CrmHeadlineBand as ProjectsHeadlineBand,
  CrmHeadlineStat as ProjectsHeadlineStat,
  CrmIconBadge as ProjectsIconBadge,
  CrmInfoBanner as ProjectsInfoBanner,
  CrmKpiCard as ProjectsKpiCard,
  CrmListPanel as ProjectsListPanel,
  CrmMetric as ProjectsMetric,
  CrmMetricStrip as ProjectsMetricStrip,
  CrmPage as ProjectsPage,
  CrmSection as ProjectsSection,
  CrmViewAllLink as ProjectsViewAllLink,
  CrmWarnBanner as ProjectsWarnBanner,
} from "@/components/crm/crm-ui";

export { CrmListToolbar as ProjectsListToolbar } from "@/components/crm/sales/crm-list-toolbar";

export {
  CrmPipelineBarChart as ProjectsCountBarChart,
  CrmRevenueBarChart as ProjectsValueBarChart,
  CrmStageDonutChart as ProjectsDonutChart,
  CRM_CHART_COLORS as PROJECTS_CHART_COLORS,
} from "@/components/crm/crm-dashboard-charts";

export {
  CrmSortableTh as ProjectsSortableTh,
  sortRows,
  useTableSort,
  type SortDir,
  type SortValue,
} from "@/components/crm/sales/crm-table-sort";
