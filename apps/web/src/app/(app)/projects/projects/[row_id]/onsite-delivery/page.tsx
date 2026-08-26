import { SiteOnsiteDeliveryFormPage } from "@/components/projects/site-onsite-delivery-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectOnsiteDeliveryRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="onsite_delivery">
      <SiteOnsiteDeliveryFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
