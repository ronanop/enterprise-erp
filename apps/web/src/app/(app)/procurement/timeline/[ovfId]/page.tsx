import { OvfTimelineDetailPage } from "@/components/procurement/ovf-timeline-page";

interface PageProps {
  params: Promise<{ ovfId: string }>;
}

export default async function ProcurementOvfTimelineDetailPage({ params }: PageProps) {
  const { ovfId } = await params;
  return <OvfTimelineDetailPage ovfId={ovfId} />;
}
