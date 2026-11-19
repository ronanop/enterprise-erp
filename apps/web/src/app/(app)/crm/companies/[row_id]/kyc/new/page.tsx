import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import { KycFormPageDynamic } from "@/components/crm/sales/kyc-form-page-dynamic";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CompanyCreateKycPage({ params }: PageProps) {
  const { row_id } = await params;
  return (
    <CompanyWorkspaceShell companyAccountId={row_id}>
      <KycFormPageDynamic companyAccountId={row_id} />
    </CompanyWorkspaceShell>
  );
}
