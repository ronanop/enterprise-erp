import { SiteAssignFormPage } from "@/components/projects/site-assign-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectAssignRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="assignment">
      <SiteAssignFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
