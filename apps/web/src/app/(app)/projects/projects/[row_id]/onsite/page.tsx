import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

/** Legacy combined On-site route — redirect to Onsite Delivery. */
export default async function ProjectOnsiteLegacyRoute({ params }: PageProps) {
  const { row_id: projectId } = await params;
  redirect(`/projects/projects/${projectId}/onsite-delivery`);
}
