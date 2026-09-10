import { NcrDetailPage } from "@/components/quality/ncr-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityNcrDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <NcrDetailPage ncrId={row_id} />;
}
