import { SupplierQualityDetailPage } from "@/components/quality/quality-extra-detail-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualitySupplierScoreDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <SupplierQualityDetailPage scoreId={row_id} />;
}
