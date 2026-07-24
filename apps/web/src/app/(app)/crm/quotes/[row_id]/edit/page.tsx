import { QuoteFormPage } from "@/components/crm/sales/quote-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmQuoteEditRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <QuoteFormPage quoteId={row_id} />;
}
