import { ResourcePlanFormPage } from "@/components/projects/resource-plan-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditResourcePlanRoute({ params }: PageProps) {
  const { row_id: planId } = await params;
  return <ResourcePlanFormPage planId={planId} />;
}
