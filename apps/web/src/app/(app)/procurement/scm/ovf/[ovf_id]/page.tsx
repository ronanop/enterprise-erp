import { ScmOvfViewPage } from "@/components/procurement/scm-ovf-view-page";

interface PageProps {
  params: Promise<{ ovf_id: string }>;
}

export default async function ProcurementScmOvfViewPage({ params }: PageProps) {
  const { ovf_id } = await params;
  return <ScmOvfViewPage ovfId={ovf_id} />;
}
