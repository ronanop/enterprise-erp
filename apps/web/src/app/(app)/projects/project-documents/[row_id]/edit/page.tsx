import { ProjectDocumentFormPage } from "@/components/projects/project-document-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditProjectDocumentRoute({ params }: PageProps) {
  const { row_id: documentId } = await params;
  return <ProjectDocumentFormPage documentId={documentId} />;
}
