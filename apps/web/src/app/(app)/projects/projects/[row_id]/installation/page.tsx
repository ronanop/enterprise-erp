import { SiteInstallFormPage } from "@/components/projects/site-install-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectInstallationRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteInstallFormPage projectId={projectId} />;
}
