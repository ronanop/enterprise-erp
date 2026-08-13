import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

/** Assign step removed — stage owners are set from Project Tracking on the detail page. */
export default async function ProjectAssignRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  redirect(`/projects/projects/${projectId}`);
}
