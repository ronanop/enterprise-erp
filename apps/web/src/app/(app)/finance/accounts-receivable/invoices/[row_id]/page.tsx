import { ArInvoiceDetailPage } from "@/components/finance/ar/ar-invoice-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ArInvoiceDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <ArInvoiceDetailPage invoiceId={row_id} />;
}
