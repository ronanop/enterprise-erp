import { redirect } from "next/navigation";

type MarketingTeamMemberPageProps = {
  params: Promise<{ memberId: string }>;
};

/** Legacy per-user team links — redirect to role-based queues. */
export default async function MarketingTeamMemberPage(_props: MarketingTeamMemberPageProps) {
  redirect("/marketing/approvals");
}
