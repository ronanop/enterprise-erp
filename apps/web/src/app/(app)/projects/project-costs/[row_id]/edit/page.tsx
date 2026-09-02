import { ProjectCostFormPage } from "@/components/projects/project-cost-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectCostRoute({ params }: PageProps) {
  const { row_id: costId } = await params;
  return <ProjectCostFormPage costId={costId} />;
}
