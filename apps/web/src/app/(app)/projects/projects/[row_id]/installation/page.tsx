import { SiteInstallFormPage } from "@/components/projects/site-install-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectInstallationRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="installation">
      <SiteInstallFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
