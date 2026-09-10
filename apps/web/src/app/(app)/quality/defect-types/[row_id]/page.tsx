import { MasterRecordDetailPage } from "@/components/quality/quality-master-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityDefectTypeDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <MasterRecordDetailPage resourceKey="defect-types" recordId={row_id} />;
}
