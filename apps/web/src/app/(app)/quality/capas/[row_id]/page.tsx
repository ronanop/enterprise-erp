import { CapaDetailPage } from "@/components/quality/capa-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityCapaDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <CapaDetailPage capaId={row_id} />;
}
