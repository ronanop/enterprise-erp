import { CompanyDetailPage } from "@/components/crm/sales/company-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmCompanyDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <CompanyDetailPage companyAccountId={row_id} />;
}
