import { PpapDetailPage } from "@/components/quality/ppap-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityPpapDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <PpapDetailPage ppapId={row_id} />;
}
