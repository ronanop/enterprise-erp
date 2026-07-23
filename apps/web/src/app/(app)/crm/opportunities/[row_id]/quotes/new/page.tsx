import { QuoteFormPage } from "@/components/crm/sales/quote-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmOpportunityNewQuoteRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <QuoteFormPage opportunityId={row_id} />;
}
