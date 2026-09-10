import { MasterRecordDetailPage } from "@/components/quality/quality-master-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityCharacteristicDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <MasterRecordDetailPage resourceKey="characteristics" recordId={row_id} />;
}
