import { ProjectRiskFormPage } from "@/components/projects/project-risk-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectRiskRoute({ params }: PageProps) {
  const { row_id: riskId } = await params;
  return <ProjectRiskFormPage riskId={riskId} />;
}
