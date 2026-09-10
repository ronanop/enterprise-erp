import { MasterRecordDetailPage } from "@/components/quality/quality-master-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityPfmeaDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <MasterRecordDetailPage resourceKey="pfmeas" recordId={row_id} />;
}
