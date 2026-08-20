import { DeliveryChallanFormPage } from "@/components/procurement/delivery-challan-form-page";

interface PageProps {
  params: Promise<{ challanId: string }>;
}

/** Opens a saved challan in read-only (locked) mode. */
export default async function DeliveryChallanDetailPage({ params }: PageProps) {
  const { challanId } = await params;
  return <DeliveryChallanFormPage challanId={challanId} />;
}
