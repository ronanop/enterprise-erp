import { OpportunityDetailPage } from "@/components/crm/sales/opportunity-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmOpportunityDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <OpportunityDetailPage opportunityId={row_id} />;
}
