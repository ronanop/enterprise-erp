import { PartyRegistrationListPage } from "@/components/master-data/party-registration-list-page";

export default function Page() {
  return (
    <PartyRegistrationListPage
      partyType="vendor"
      basePath="/master-data/vendor-registrations"
    />
  );
}
