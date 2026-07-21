import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function PortalResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("portal");
  const resource = getResource("portal", resourceKey);
  if (!mod || !resource) notFound();

  return (
    <ResourceListView
      moduleKey={mod.key}
      moduleTitle={mod.title}
      title={resource.title}
      description={resource.description}
      apiPath={resource.apiPath}
    />
  );
}
