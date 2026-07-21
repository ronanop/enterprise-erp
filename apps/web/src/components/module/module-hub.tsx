import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import type { ErpModule } from "@/config/modules";

interface ModuleHubProps {
  module: ErpModule;
}

export function ModuleHub({ module }: ModuleHubProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={module.title}
        description={module.description}
        actions={
          <Badge variant="secondary" className="font-medium">
            {module.resources.length} resources
          </Badge>
        }
      />

      <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        Open a resource to load live records from{" "}
        <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">/api/v1</code>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {module.resources.map((resource) => (
          <Link
            key={resource.key}
            href={`/${module.key}/${resource.key}`}
            className="group rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium tracking-tight text-foreground">{resource.title}</h3>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {resource.description}
            </p>
            <code className="block truncate rounded-md bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground">
              {resource.apiPath}
            </code>
          </Link>
        ))}
      </div>
    </div>
  );
}
