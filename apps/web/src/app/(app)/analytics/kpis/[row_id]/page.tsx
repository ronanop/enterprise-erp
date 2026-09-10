import { KpiDetailPage } from "@/components/analytics/kpi-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function AnalyticsKpiDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <KpiDetailPage kpiId={row_id} />;
}
