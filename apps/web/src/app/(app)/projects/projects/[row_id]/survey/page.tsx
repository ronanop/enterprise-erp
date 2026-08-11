import { SiteSurveyFormPage } from "@/components/projects/site-survey-form-page";
import { SiteStageFormGate } from "@/components/projects/site-stage-form-gate";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectSurveyRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return (
    <SiteStageFormGate projectId={projectId} stage="survey">
      <SiteSurveyFormPage projectId={projectId} />
    </SiteStageFormGate>
  );
}
