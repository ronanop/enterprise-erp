import { OvfFormPage } from "@/components/crm/sales/ovf-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function CrmOvfEditRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <OvfFormPage ovfId={row_id} />;
}
