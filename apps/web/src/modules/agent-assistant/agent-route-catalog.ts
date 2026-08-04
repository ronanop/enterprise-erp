import { erpModules, getModule, getResource, type ErpModule, type ModuleResource } from "@/config/modules";

export type AgentScreenEntry = {
  moduleKey: string;
  moduleTitle: string;
  moduleHref: string;
  resourceKey: string;
  resourceTitle: string;
  description: string;
  listHref: string;
  apiPath: string;
};

const EMAIL_RESOURCE_HREF: Record<string, string> = {
  overview: "/email",
  compose: "/email/compose",
  templates: "/email/templates",
  deliveries: "/email/deliveries",
  events: "/email/events",
};

function resolveListHref(mod: ErpModule, resource: ModuleResource): string {
  if (mod.key === "email") {
    return EMAIL_RESOURCE_HREF[resource.key] ?? `${mod.href}/${resource.key}`;
  }
  if (mod.key === "voice-agent") {
    return mod.href;
  }
  if (mod.key === "crm" || mod.key === "finance" || mod.key === "procurement" || mod.key === "projects") {
    return `/${mod.key}/${resource.key}`;
  }
  return `/${mod.key}/${resource.key}`;
}

/** Flat catalog of module workspaces and list screens (matches Next.js routes). */
export function buildNavigationCatalog(): AgentScreenEntry[] {
  const entries: AgentScreenEntry[] = [
    {
      moduleKey: "platform",
      moduleTitle: "Overview",
      moduleHref: "/",
      resourceKey: "dashboard",
      resourceTitle: "Dashboard",
      description: "Platform status and all modules",
      listHref: "/",
      apiPath: "/health",
    },
  ];

  for (const mod of erpModules) {
    for (const resource of mod.resources) {
      entries.push({
        moduleKey: mod.key,
        moduleTitle: mod.title,
        moduleHref: mod.href,
        resourceKey: resource.key,
        resourceTitle: resource.title,
        description: resource.description,
        listHref: resolveListHref(mod, resource),
        apiPath: resource.apiPath,
      });
    }
  }

  return entries;
}

export function resolveModuleResourceHref(moduleKey: string, resourceKey: string): string | null {
  const mod = getModule(moduleKey);
  const resource = getResource(moduleKey, resourceKey);
  if (!mod || !resource) return null;
  return resolveListHref(mod, resource);
}

export function resolveRecordHref(
  moduleKey: string,
  resourceKey: string,
  recordId: string,
): string | null {
  const listHref = resolveModuleResourceHref(moduleKey, resourceKey);
  if (!listHref) return null;
  const id = recordId.trim();
  if (!id) return null;
  return `${listHref.replace(/\/$/, "")}/${id}`;
}
