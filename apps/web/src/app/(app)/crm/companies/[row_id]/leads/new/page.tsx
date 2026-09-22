import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

/** Compat redirect — nested path 404s under Turbopack; canonical is `/new-lead`. */
export default async function CrmCompanyNewLeadLegacyRedirect({ params }: PageProps) {
  const { row_id } = await params;
  redirect(`/crm/companies/${row_id}/new-lead`);
}
