"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ResourceListView } from "@/components/module/resource-list-view";
import { Button } from "@/components/ui/button";

type Props = {
  kind: "locations" | "departments";
};

const COPY = {
  locations: {
    title: "Locations",
    description: "Physical locations used when assigning assets. Managed in Organization.",
    orgHref: "/organization/locations",
    apiPath: "/locations",
  },
  departments: {
    title: "Departments",
    description: "Departments for asset custody and reporting. Managed in Organization.",
    orgHref: "/organization/departments",
    apiPath: "/departments",
  },
} as const;

export function AssetOrgMasterWrapper({ kind }: Props) {
  const meta = COPY[kind];
  return (
    <div className="space-y-4">
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <Button variant="outline" size="sm" asChild className="cursor-pointer">
            <Link href={meta.orgHref}>Open in Organization</Link>
          </Button>
        }
      />
      <ResourceListView
        moduleKey="organization"
        moduleTitle="Organization"
        title={meta.title}
        description="Read-only view from organization master."
        apiPath={meta.apiPath}
        showRowSerial
      />
    </div>
  );
}
