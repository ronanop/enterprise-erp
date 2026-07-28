import { ChangeRequestFormPage } from "@/components/projects/change-request-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditChangeRequestRoute({ params }: PageProps) {
  const { row_id: changeRequestId } = await params;
  return <ChangeRequestFormPage changeRequestId={changeRequestId} />;
}
