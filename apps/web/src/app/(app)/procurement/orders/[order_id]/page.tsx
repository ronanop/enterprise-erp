import { Suspense } from "react";

import { OrderDetailPage } from "@/components/procurement/order-detail-page";

interface PageProps {
  params: Promise<{ order_id: string }>;
}

export default async function ProcurementOrderDetailPage({ params }: PageProps) {
  const { order_id } = await params;
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading purchase order…</p>}
    >
      <OrderDetailPage orderId={order_id} />
    </Suspense>
  );
}
