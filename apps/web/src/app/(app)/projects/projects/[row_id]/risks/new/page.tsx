import { ProjectRiskFormPage } from "@/components/projects/project-risk-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectRiskRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectRiskFormPage presetProjectId={projectId} />;
}
