import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ row_id: string; lead_id: string }> };

/** Compat redirect — nested path 404s under Turbopack; canonical is `/edit-lead/[lead_id]`. */
export default async function CrmEditLeadLegacyRedirect({ params }: PageProps) {
  const { row_id, lead_id } = await params;
  redirect(`/crm/companies/${row_id}/edit-lead/${lead_id}`);
}
