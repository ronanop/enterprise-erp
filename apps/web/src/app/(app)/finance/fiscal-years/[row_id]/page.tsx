import { FiscalDetailPage } from "@/components/finance/fiscal/fiscal-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function FiscalYearDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <FiscalDetailPage fiscalYearId={row_id} />;
}
