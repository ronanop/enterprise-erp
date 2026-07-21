import { LeadDetailPage } from "@/components/crm/sales/lead-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmLeadDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <LeadDetailPage leadId={row_id} />;
}
