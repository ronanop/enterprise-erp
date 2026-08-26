import { ProjectIssueFormPage } from "@/components/projects/project-issue-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectIssueRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectIssueFormPage presetProjectId={projectId} />;
}
