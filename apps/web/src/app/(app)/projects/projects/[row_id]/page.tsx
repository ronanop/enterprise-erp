import { ProjectDetailPage } from "@/components/projects/project-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function ProjectDetailRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  return <ProjectDetailPage projectId={projectId} />;
}
