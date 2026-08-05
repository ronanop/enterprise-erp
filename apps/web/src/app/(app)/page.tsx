import DashboardPageClient from "./dashboard-page-client";

/** Server page — avoids ClientPageRoot injecting Promise params/searchParams. */
export default function DashboardPage() {
  return <DashboardPageClient />;
}
