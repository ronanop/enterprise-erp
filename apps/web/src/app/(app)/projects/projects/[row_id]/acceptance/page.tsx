import { SiteAcceptanceFormPage } from "@/components/projects/site-acceptance-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectAcceptanceRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="acceptance">
      <SiteAcceptanceFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
