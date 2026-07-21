import { QuoteDetailPage } from "@/components/crm/sales/quote-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmQuoteDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <QuoteDetailPage quoteId={row_id} />;
}
