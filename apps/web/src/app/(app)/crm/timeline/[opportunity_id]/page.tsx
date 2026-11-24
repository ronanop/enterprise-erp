import { DealTimelineDetailPage } from "@/components/crm/deal-timeline-detail-page";

interface PageProps {
  params: Promise<{ opportunity_id: string }>;
}

export default async function CrmDealTimelineDetailRoute({ params }: PageProps) {
  const { opportunity_id } = await params;
  return <DealTimelineDetailPage opportunityId={opportunity_id} />;
}
