import { notFound } from "next/navigation";

import { ResourceListView } from "@/components/module/resource-list-view";
import { getModule, getResource } from "@/config/modules";

interface PageProps {
  params: Promise<{ resource: string }>;
}

export default async function QualityResourcePage({ params }: PageProps) {
  const { resource: resourceKey } = await params;
  const mod = getModule("quality");
  const resource = getResource("quality", resourceKey);
  if (!mod || !resource) notFound();

  const createRoutes: Record<string, string> = {
    plans: "/quality/plans/new",
    "sampling-plans": "/quality/sampling-plans/new",
    characteristics: "/quality/characteristics/new",
    "defect-types": "/quality/defect-types/new",
    pfmeas: "/quality/pfmeas/new",
    scores: "/quality/scores/new",
    "incoming-inspections": "/quality/incoming-inspections/new",
    "inprocess-inspections": "/quality/inprocess-inspections/new",
    "final-inspections": "/quality/final-inspections/new",
    "vin-traces": "/quality/vin-traces/new",
    defects: "/quality/defects/new",
    ncrs: "/quality/ncrs/new",
    scars: "/quality/scars/new",
    capas: "/quality/capas/new",
    ppaps: "/quality/ppaps/new",
    complaints: "/quality/complaints/new",
    "warranty-claims": "/quality/warranty-claims/new",
    recalls: "/quality/recalls/new",
    audits: "/quality/audits/new",
    "supplier-quality": "/quality/supplier-quality/new",
  };

  return (
    <ResourceListView
      moduleKey={mod.key}
      moduleTitle={mod.title}
      title={resource.title}
      description={resource.description}
      apiPath={resource.apiPath}
      createHref={createRoutes[resourceKey]}
    />
  );
}
