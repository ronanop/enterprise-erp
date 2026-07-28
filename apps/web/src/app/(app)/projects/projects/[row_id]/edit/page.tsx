import { ProjectFormPage } from "@/components/projects/project-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectFormPage projectId={projectId} />;
}
