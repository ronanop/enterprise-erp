import { SiteOnsiteFormPage } from "@/components/projects/site-onsite-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectOnsiteRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="onsite">
      <SiteOnsiteFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
