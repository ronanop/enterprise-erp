import { WarrantyClaimDetailPage } from "@/components/quality/warranty-claim-detail-page";

interface PageProps {
  params: Promise<{ row_id: string }>;
}

export default async function QualityWarrantyClaimDetailRoute({ params }: PageProps) {
  const { row_id } = await params;
  return <WarrantyClaimDetailPage claimId={row_id} />;
}
