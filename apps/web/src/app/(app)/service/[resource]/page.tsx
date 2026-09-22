import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

/** SOP workflow uses dedicated pages; generic list views are disabled. */
const ALLOWED_SERVICE_RESOURCES = new Set<string>();

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function ServiceResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  if (!ALLOWED_SERVICE_RESOURCES.has(resourceKey)) notFound();

  const mod = getModule("service");
  const resource = getResource("service", resourceKey);
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
