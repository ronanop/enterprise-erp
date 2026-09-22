import { ReportViewPage } from "@/components/crm/sales/report-view-page";

interface PageProps {
  params: Promise<{ report_id: string }>;
}

export default async function CrmReportViewRoute({ params }: PageProps) {
  const { report_id } = await params;
  return <ReportViewPage reportId={report_id} />;
}
