import { PartyRegistrationDetailPage } from "@/components/master-data/party-registration-detail-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <PartyRegistrationDetailPage
      registrationId={id}
      partyType="customer"
      basePath="/master-data/customer-registrations"
    />
  );
}
