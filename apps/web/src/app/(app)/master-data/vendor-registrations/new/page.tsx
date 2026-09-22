import { PartyRegistrationFormPage } from "@/components/master-data/party-registration-form-page";

export default function Page() {
  return (
    <PartyRegistrationFormPage
      partyType="vendor"
      basePath="/master-data/vendor-registrations"
    />
  );
}
