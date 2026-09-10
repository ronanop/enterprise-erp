import { InspectionPlanDetailPage } from "@/components/quality/quality-master-pages";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityPlanDetailPage({ params }: PageProps) {
  const { row_id } = await params;
  return <InspectionPlanDetailPage planId={row_id} />;
}
