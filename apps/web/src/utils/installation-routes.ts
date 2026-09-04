export function installationListHref(): string {
  return "/procurement/installation";
}

export function installationDetailHref(challanId: string): string {
  return `/procurement/installation?challan=${encodeURIComponent(challanId)}`;
}
