import { CandidateOnboardingPortal } from "@/components/hr/onboarding/candidate-onboarding-portal";

export default async function PublicOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CandidateOnboardingPortal token={token} />;
}
