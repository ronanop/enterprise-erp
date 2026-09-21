import { PartyRegistrationDetailPage } from "@/components/master-data/party-registration-detail-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <PartyRegistrationDetailPage
      registrationId={id}
      partyType="vendor"
      basePath="/master-data/vendor-registrations"
    />
  );
}
