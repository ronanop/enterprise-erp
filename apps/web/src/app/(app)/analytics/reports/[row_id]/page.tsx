import { ReportDetailPage } from "@/components/analytics/report-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function AnalyticsReportDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ReportDetailPage reportId={row_id} />;
}
