import { SiteAssignFormPage } from "@/components/projects/site-assign-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectAssignRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteAssignFormPage projectId={projectId} />;
}
