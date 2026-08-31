import { notFound, redirect } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

/** Masters owned by HR Setup — avoid duplicate CRUD under /hr/{resource}. */
const SETUP_REDIRECTS: Record<string, string> = {
  "leave-types": "/hr/setup?section=leave&tab=leave-types",
};

export default async function HrResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;

  const setupHref = SETUP_REDIRECTS[resourceKey];
  if (setupHref) redirect(setupHref);

  const mod = getModule("hr");
  const resource = getResource("hr", resourceKey);
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
