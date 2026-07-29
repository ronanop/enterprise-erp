import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

/** Configuration is merged into Installation — keep route for old bookmarks. */
export default async function ProjectConfigurationRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  redirect(`/projects/projects/${projectId}/installation`);
}
