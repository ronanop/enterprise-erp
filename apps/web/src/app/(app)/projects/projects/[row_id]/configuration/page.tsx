import { SiteConfigurationFormPage } from "@/components/projects/site-configuration-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectConfigurationRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteConfigurationFormPage projectId={projectId} />;
}
