import { PartyRegistrationFormPage } from "@/components/master-data/party-registration-form-page";

export default function Page() {
  return (
    <PartyRegistrationFormPage
      partyType="customer"
      basePath="/master-data/customer-registrations"
    />
  );
}
