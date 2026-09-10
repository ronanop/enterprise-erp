import { DefectDetailPage } from "@/components/quality/quality-extra-detail-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityDefectDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <DefectDetailPage defectId={row_id} />;
}
