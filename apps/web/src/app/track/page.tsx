import type { Metadata } from "next";

import { OrderTrackingPortal } from "@/components/procurement/order-tracking-portal";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your order using your PO number.",
};

export default function OrderTrackingPage() {
  return <OrderTrackingPortal />;
}
