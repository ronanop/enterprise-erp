import { notFound } from "next/navigation";

import { ModuleUsersPage } from "@/components/organization/module-users-page";
import { getModule } from "@/config/modules";

interface PageProps {
  params: Promise<{ module: string }>;
}

export default async function Page({ params }: PageProps) {
  const { module: moduleKey } = await params;
  if (!getModule(moduleKey) || moduleKey === "organization") notFound();
  return <ModuleUsersPage moduleKey={moduleKey} />;
}
