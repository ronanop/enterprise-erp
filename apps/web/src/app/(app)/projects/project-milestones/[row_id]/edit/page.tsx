import { ProjectMilestoneFormPage } from "@/components/projects/project-milestone-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditMilestoneRoute({ params }: PageProps) {
  const { row_id: milestoneId } = await params;
  return <ProjectMilestoneFormPage milestoneId={milestoneId} />;
}
