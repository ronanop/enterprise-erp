import { SiteAcceptanceFormPage } from "@/components/projects/site-acceptance-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectAcceptanceRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteAcceptanceFormPage projectId={projectId} />;
}
