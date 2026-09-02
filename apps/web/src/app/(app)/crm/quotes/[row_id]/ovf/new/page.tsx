import { OvfFormPage } from "@/components/crm/sales/ovf-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmQuoteNewOvfRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <OvfFormPage quoteId={row_id} />;
}
