import { ScmOvfItemPlanPage } from "@/components/procurement/scm-ovf-item-plan-page";

interface PageProps {
  params: Promise<{ ovf_id: string }>;
}

export default async function ProcurementScmOvfItemPlanPage({ params }: PageProps) {
  const { ovf_id } = await params;
  return <ScmOvfItemPlanPage ovfId={ovf_id} />;
}
