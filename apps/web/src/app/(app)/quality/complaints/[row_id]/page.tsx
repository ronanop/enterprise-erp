import { ComplaintDetailPage } from "@/components/quality/quality-extra-detail-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityComplaintDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ComplaintDetailPage complaintId={row_id} />;
}
