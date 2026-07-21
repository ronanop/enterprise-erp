import { ApInvoiceDetailPage } from "@/components/finance/ap/ap-invoice-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ApInvoiceDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ApInvoiceDetailPage invoiceId={row_id} />;
}
