import { ScmOvfFromStockPage } from "@/components/procurement/scm-ovf-from-stock-page";

interface PageProps {
  params: Promise<{ ovf_id: string }>;
}

export default async function ProcurementScmOvfFromStockPage({ params }: PageProps) {
  const { ovf_id } = await params;
  return <ScmOvfFromStockPage ovfId={ovf_id} />;
}
