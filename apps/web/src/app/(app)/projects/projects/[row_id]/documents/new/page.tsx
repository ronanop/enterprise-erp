import { ProjectDocumentFormPage } from "@/components/projects/project-document-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectDocumentRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectDocumentFormPage presetProjectId={projectId} />;
}
