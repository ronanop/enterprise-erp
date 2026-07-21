import { GlDetailPage } from "@/components/finance/gl/gl-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function GeneralLedgerDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <GlDetailPage entryId={row_id} />;
}
