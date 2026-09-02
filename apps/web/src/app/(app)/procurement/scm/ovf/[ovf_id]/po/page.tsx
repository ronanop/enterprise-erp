import { ScmCreatePoPage } from "@/components/procurement/scm-create-po-page";

interface PageProps {
  params: Promise<{ ovf_id: string }>;
}

export default async function ProcurementScmCreatePoPage({ params }: PageProps) {
  const { ovf_id } = await params;
  return <ScmCreatePoPage ovfId={ovf_id} />;
}
