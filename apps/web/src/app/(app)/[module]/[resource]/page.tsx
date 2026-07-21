import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ module: string; resource: string }>;
}

export default async function ResourcePage({ params }: PageProps) {
  const { module: moduleKey, resource: resourceKey } = await params;
  const mod = getModule(moduleKey);
  const resource = getResource(moduleKey, resourceKey);
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
