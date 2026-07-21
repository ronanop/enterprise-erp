import { CoaDetailPage } from "@/components/finance/coa/coa-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ChartOfAccountsDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <CoaDetailPage accountId={row_id} />;
}
