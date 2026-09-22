import { CompanyWorkspaceShell } from "@/components/crm/company-workspace-shell";
import { LeadFormPage } from "@/components/crm/sales/lead-form-page";

type PageProps = { params: Promise<{ row_id: string; lead_id: string }> };

/** Flat under company — nested `leads/[lead_id]/edit` 404s under Turbopack + route groups. */
export default async function CrmEditLeadRoute({ params }: PageProps) {
  const { row_id, lead_id } = await params;
  return (
    <CompanyWorkspaceShell companyAccountId={row_id}>
      <LeadFormPage companyAccountId={row_id} leadId={lead_id} />
    </CompanyWorkspaceShell>
  );
}
