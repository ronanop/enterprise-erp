import { FieldEngineerRouteGuard } from "@/components/service/field-engineer-route-guard";
import { FieldEngineerDashboardPage } from "@/components/service/tickets/field-engineer-dashboard-page";

export default function Page() {
  return (
    <FieldEngineerRouteGuard>
      <FieldEngineerDashboardPage />
    </FieldEngineerRouteGuard>
  );
}
