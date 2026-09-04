import { ProjectMilestoneFormPage } from "@/components/projects/project-milestone-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectMilestoneRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectMilestoneFormPage presetProjectId={projectId} />;
}
