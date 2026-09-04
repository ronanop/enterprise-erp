import { ChangeRequestFormPage } from "@/components/projects/change-request-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function NewProjectChangeRequestRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ChangeRequestFormPage presetProjectId={projectId} />;
}
