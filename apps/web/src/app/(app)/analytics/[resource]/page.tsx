import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function AnalyticsResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("analytics");
  const resource = getResource("analytics", resourceKey);
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
