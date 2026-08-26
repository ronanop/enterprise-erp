import { ProjectTaskFormPage } from "@/components/projects/project-task-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectTaskRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectTaskFormPage presetProjectId={projectId} />;
}
