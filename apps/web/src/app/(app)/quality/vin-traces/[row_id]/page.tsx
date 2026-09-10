import { VinTraceDetailPage } from "@/components/quality/vin-trace-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityVinTraceDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <VinTraceDetailPage traceId={row_id} />;
}
