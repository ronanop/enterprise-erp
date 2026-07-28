import { ProjectTaskFormPage } from "@/components/projects/project-task-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditTaskRoute({ params }: PageProps) {
  const { row_id: taskId } = await params;
  return <ProjectTaskFormPage taskId={taskId} />;
}
