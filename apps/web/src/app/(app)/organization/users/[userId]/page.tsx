import { HrmsUserProfilePage } from "@/components/organization/hrms-user-profile-page";

export default async function OrganizationUserProfileRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <HrmsUserProfilePage userId={userId} />;
}
