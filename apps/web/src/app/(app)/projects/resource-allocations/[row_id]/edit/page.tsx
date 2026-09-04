import { ResourceAllocationFormPage } from "@/components/projects/resource-allocation-form-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function EditResourceAllocationRoute({ params }: PageProps) {
  const { row_id: allocationId } = await params;
  return <ResourceAllocationFormPage allocationId={allocationId} />;
}
