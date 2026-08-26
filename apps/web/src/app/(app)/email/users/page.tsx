import { EmailWorkspaceNav } from "@/components/email/email-workspace-nav";
import { ModuleUsersPage } from "@/components/organization/module-users-page";

export default function Page() {
  return (
    <div className="space-y-4">
      <EmailWorkspaceNav />
      <ModuleUsersPage moduleKey="email" />
    </div>
  );
}
