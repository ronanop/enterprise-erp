import { OvfDetailPage } from "@/components/crm/sales/ovf-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmOvfDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <OvfDetailPage ovfId={row_id} />;
}
