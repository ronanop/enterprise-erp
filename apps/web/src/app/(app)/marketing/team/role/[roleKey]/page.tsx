import { MarketingTeamRoleQueuePage } from "@/components/marketing/marketing-team-role-queue-page";

type MarketingTeamRolePageProps = {
  params: Promise<{ roleKey: string }>;
};

export default async function MarketingTeamRolePage({ params }: MarketingTeamRolePageProps) {
  const { roleKey } = await params;
  return <MarketingTeamRoleQueuePage roleKey={roleKey} />;
}
