import { ProjectIssueFormPage } from "@/components/projects/project-issue-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectIssueRoute({ params }: PageProps) {
  const { row_id: issueId } = await params;
  return <ProjectIssueFormPage issueId={issueId} />;
}
