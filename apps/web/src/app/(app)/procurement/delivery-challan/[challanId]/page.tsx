import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ challanId: string }>;
}

/** Saved challans are immutable — use the list page and PDF download only. */
export default async function DeliveryChallanDetailPage({ params }: PageProps) {
  await params;
  redirect("/procurement/delivery-challan");
}
