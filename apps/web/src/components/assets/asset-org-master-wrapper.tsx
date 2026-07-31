"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ResourceListView } from "@/components/module/resource-list-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <Link
            href={meta.orgHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
          >
            Open in Organization
          </Link>
        }
      />
      <ResourceListView
        moduleKey="organization"
        moduleTitle="Organization"
        title={meta.title}
        description="Read-only view from organization master."
        apiPath={meta.apiPath}
      />
    </div>
  );
}
