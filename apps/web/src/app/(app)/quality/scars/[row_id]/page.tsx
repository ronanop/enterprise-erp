import { ScarDetailPage } from "@/components/quality/scar-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityScarDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ScarDetailPage scarId={row_id} />;
}
