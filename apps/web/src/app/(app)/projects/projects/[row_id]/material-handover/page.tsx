import { SiteMaterialHandoverFormPage } from "@/components/projects/site-material-handover-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectMaterialHandoverRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="material_handover">
      <SiteMaterialHandoverFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
