import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import { CompanyFormPage } from "@/components/crm/sales/company-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmEditCompanyRoute({ params }: PageProps) {
  const { row_id } = await params;
  return (
    <CompanyWorkspaceShell companyAccountId={row_id}>
      <CompanyFormPage companyId={row_id} />
    </CompanyWorkspaceShell>
  );
}
