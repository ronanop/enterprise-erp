import { OrderDetailPage } from "@/components/procurement/order-detail-page";

interface PageProps {
  params: Promise<{ order_id: string }>;
}

export default async function ProcurementOrderDetailPage({ params }: PageProps) {
  const { order_id } = await params;
  return <OrderDetailPage orderId={order_id} />;
}
