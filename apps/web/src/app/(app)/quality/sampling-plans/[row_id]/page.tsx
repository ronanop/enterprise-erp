import { MasterRecordDetailPage } from "@/components/quality/quality-master-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualitySamplingPlanDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <MasterRecordDetailPage resourceKey="sampling-plans" recordId={row_id} />;
}
