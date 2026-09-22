import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import { LeadFormPage } from "@/components/crm/sales/lead-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

/** Flat sibling of `[section]` — nested `leads/new` 404s under Turbopack + route groups. */
export default async function CrmCompanyNewLeadRoute({ params }: PageProps) {
  const { row_id } = await params;
  return (
    <CompanyWorkspaceShell companyAccountId={row_id}>
      <LeadFormPage companyAccountId={row_id} />
    </CompanyWorkspaceShell>
  );
}
