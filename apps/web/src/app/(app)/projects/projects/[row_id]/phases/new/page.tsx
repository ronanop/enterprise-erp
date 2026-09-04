import { ProjectPhaseFormPage } from "@/components/projects/project-phase-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectPhaseRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectPhaseFormPage presetProjectId={projectId} />;
}
