import { RecallDetailPage } from "@/components/quality/recall-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityRecallDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <RecallDetailPage recallId={row_id} />;
}
