import { PartyRegistrationFormPage } from "@/components/master-data/party-registration-form-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <PartyRegistrationFormPage
      partyType="vendor"
      basePath="/master-data/vendor-registrations"
      registrationId={id}
    />
  );
}
