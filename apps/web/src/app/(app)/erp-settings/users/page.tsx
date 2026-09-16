"use client";

import { OrganizationUsersPage } from "@/components/organization/organization-users-page";

export default function ErpSettingsUsersPage() {
  return (
    <OrganizationUsersPage
      title="User Management"
      description="Manage ERP users, assign module admins, and sync organization members from Microsoft 365 (@cachedigitech.com)."
      backHref="/erp-settings"
      backLabel="ERP Settings"
    />
  );
}
