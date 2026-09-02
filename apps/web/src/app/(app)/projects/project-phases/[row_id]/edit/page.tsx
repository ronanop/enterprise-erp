import { ProjectPhaseFormPage } from "@/components/projects/project-phase-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditPhaseRoute({ params }: PageProps) {
  const { row_id: phaseId } = await params;
  return <ProjectPhaseFormPage phaseId={phaseId} />;
}
