import { ServiceRequestTicketDetailPage } from "@/components/service/tickets/service-request-ticket-detail-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ServiceRequestTicketDetailPage ticketId={id} />;
}
