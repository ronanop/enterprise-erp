/**
 * CRM names for the shared workspace kit (`components/shared`).
 * New code should import from `components/shared` directly.
 */
export {
  SECTION_TITLE as CRM_SECTION_TITLE,
  TABLE_HEAD_CELL as CRM_TABLE_HEAD_CELL,
  TABLE_HEAD_ROW as CRM_TABLE_HEAD_ROW,
  ActivityTile as CrmActivityTile,
  CountBadge as CrmCountBadge,
  DetailGrid as CrmDetailGrid,
  DetailItem as CrmDetailItem,
  HeadlineBand as CrmHeadlineBand,
  HeadlineStat as CrmHeadlineStat,
  IconBadge as CrmIconBadge,
  InfoBanner as CrmInfoBanner,
  ListPanel as CrmListPanel,
  Metric as CrmMetric,
  MetricStrip as CrmMetricStrip,
  ViewAllLink as CrmViewAllLink,
  WarnBanner as CrmWarnBanner,
  WorkspacePage as CrmPage,
  WorkspaceSection as CrmSection,
} from "@/components/shared/workspace-ui";

export { KpiCard as CrmKpiCard } from "@/components/shared/kpi-card";
export { ErrorBanner as CrmErrorBanner } from "@/components/shared/error-banner";

/** Fixed leading serial column header for CRM hand-built tables. */
export function CrmSerialTh() {
  return (
    <th
      scope="col"
      className="w-12 px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-foreground uppercase tabular-nums"
    >
      #
    </th>
  );
}

/** 1-based serial cell; pass the row index from the current visible list. */
export function CrmSerialTd({ index }: { index: number }) {
  return (
    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{index + 1}</td>
  );
}
