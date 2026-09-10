import { InspectionDetailPage } from "@/components/quality/inspection-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function IncomingInspectionDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <InspectionDetailPage inspectionId={row_id} type="incoming" />;
}
