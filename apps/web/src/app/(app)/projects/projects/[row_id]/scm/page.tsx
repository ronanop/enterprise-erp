import { SiteScmFormPage } from "@/components/projects/site-scm-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectScmRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteScmFormPage projectId={projectId} />;
}
