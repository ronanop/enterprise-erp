import { ReportBuilderPage } from "@/components/crm/sales/report-builder-page";

interface PageProps {
  params: Promise<{ report_id: string }>;
}

export default async function CrmReportEditRoute({ params }: PageProps) {
  const { report_id } = await params;
  return <ReportBuilderPage mode="edit" reportId={report_id} />;
}
