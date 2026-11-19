export function deliveryStatusUpdateHref(challanId: string): string {
  return `/procurement/delivery-status?challan=${encodeURIComponent(challanId)}`;
}
