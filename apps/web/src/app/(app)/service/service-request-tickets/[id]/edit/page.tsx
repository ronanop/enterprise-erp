import { ServiceRequestTicketFormPage } from "@/components/service/tickets/service-request-ticket-form-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ServiceRequestTicketFormPage ticketId={id} />;
}
