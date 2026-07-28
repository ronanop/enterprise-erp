import { SiteSurveyFormPage } from "@/components/projects/site-survey-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectSurveyRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <SiteSurveyFormPage projectId={projectId} />;
}
