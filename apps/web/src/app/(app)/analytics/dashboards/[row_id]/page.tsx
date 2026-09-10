import { DashboardDetailPage } from "@/components/analytics/dashboard-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function AnalyticsDashboardDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <DashboardDetailPage dashboardId={row_id} />;
}
