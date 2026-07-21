import { LeadFormPage } from "@/components/crm/sales/lead-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmCompanyNewLeadRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <LeadFormPage companyAccountId={row_id} />;
}
