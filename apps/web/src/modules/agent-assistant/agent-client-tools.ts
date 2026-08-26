import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  buildNavigationCatalog,
  resolveModuleResourceHref,
  resolveRecordHref,
} from "@/modules/agent-assistant/agent-route-catalog";
import { apiClient } from "@/services/api-client";
import { fetchAgentLead, leadDisplayName } from "@/services/voice-agent-service";

const MAX_AGENT_JSON_CHARS = 28_000;

export type AgentClientTools = Record<string, (parameters: Record<string, unknown>) => unknown>;

export type CreateAgentClientToolsOptions = {
  router: AppRouterInstance;
  onLeadPreview?: (lead: Awaited<ReturnType<typeof fetchAgentLead>>) => void;
};

function assertSafeAppPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("..")) {
    throw new Error("Invalid app path. Use an in-app path such as /crm/leads.");
  }
  return trimmed;
}

function assertSafeApiPath(apiPath: string): string {
  const trimmed = apiPath.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("..")) {
    throw new Error("Invalid API path. Use paths from the navigation catalog apiPath field.");
  }
  if (!/^\/[a-z0-9][a-z0-9\-_/]*$/i.test(trimmed.split("?")[0] ?? trimmed)) {
    throw new Error("API path contains invalid characters.");
  }
  return trimmed.split("?")[0] ?? trimmed;
}

function parseQueryJson(queryJson?: unknown): Record<string, string | number | boolean> | undefined {
  if (queryJson === undefined || queryJson === null || queryJson === "") return undefined;
  if (typeof queryJson === "object" && !Array.isArray(queryJson)) {
    return queryJson as Record<string, string | number | boolean>;
  }
  if (typeof queryJson !== "string") {
    throw new Error("queryJson must be a JSON object string or object.");
  }
  const parsed = JSON.parse(queryJson) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("queryJson must deserialize to a JSON object.");
  }
  return parsed as Record<string, string | number | boolean>;
}

function jsonForAgent(data: unknown): string {
  const text = JSON.stringify(data);
  if (text.length <= MAX_AGENT_JSON_CHARS) return text;
  return JSON.stringify({
    truncated: true,
    message: `Response exceeded ${MAX_AGENT_JSON_CHARS} characters; narrow filters or fetch a single record by id.`,
    preview: text.slice(0, MAX_AGENT_JSON_CHARS),
  });
}

function wrapClientTools(tools: AgentClientTools): AgentClientTools {
  return Object.fromEntries(
    Object.entries(tools).map(([name, handler]) => [
      name,
      async (parameters: Record<string, unknown>) => {
        try {
          const result = await Promise.resolve(handler(parameters));
          if (result === undefined || result === null) return "OK";
          return typeof result === "string" ? result : JSON.stringify(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown tool error";
          return `Tool error (${name}): ${message}`;
        }
      },
    ]),
  );
}

/**
 * Client tools for ElevenLabs (widget + @elevenlabs/react).
 * Tool names must match definitions in the ElevenLabs agent dashboard.
 */
export function createAgentClientTools({
  router,
  onLeadPreview,
}: CreateAgentClientToolsOptions): AgentClientTools {
  const raw: AgentClientTools = {
    listAppScreens: ({ moduleKey } = {}) => {
      const key = moduleKey ? String(moduleKey).trim() : "";
      if (key) {
        const catalog = buildNavigationCatalog().filter((s) => s.moduleKey === key);
        return jsonForAgent({
          moduleKey: key,
          screenCount: catalog.length,
          screens: catalog,
        });
      }
      const modules = buildNavigationCatalog()
        .reduce<
          { moduleKey: string; moduleTitle: string; moduleHref: string; resourceCount: number }[]
        >((acc, screen) => {
          const existing = acc.find((m) => m.moduleKey === screen.moduleKey);
          if (existing) {
            existing.resourceCount += 1;
            return acc;
          }
          acc.push({
            moduleKey: screen.moduleKey,
            moduleTitle: screen.moduleTitle,
            moduleHref: screen.moduleHref,
            resourceCount: 1,
          });
          return acc;
        }, []);
      return jsonForAgent({
        moduleCount: modules.length,
        modules,
        hint: "Call listAppScreens again with moduleKey (e.g. crm) for screen listHref and apiPath values.",
      });
    },

    navigateToPath: ({ path }) => {
      const safe = assertSafeAppPath(String(path ?? ""));
      router.push(safe);
      return `Navigated to ${safe}.`;
    },

    navigateToModuleResource: ({ moduleKey, resourceKey }) => {
      const href = resolveModuleResourceHref(String(moduleKey ?? ""), String(resourceKey ?? ""));
      if (!href) {
        return "Unknown module or resource. Call listAppScreens for valid keys.";
      }
      router.push(href);
      return `Navigated to ${href}.`;
    },

    openRecordPage: ({ moduleKey, resourceKey, recordId }) => {
      const href = resolveRecordHref(
        String(moduleKey ?? ""),
        String(resourceKey ?? ""),
        String(recordId ?? ""),
      );
      if (!href) {
        return "Could not resolve record URL. Try navigateToPath with the full path.";
      }
      router.push(href);
      return `Opened record page ${href}.`;
    },

    erpApiGet: async ({ apiPath, queryJson }) => {
      const path = assertSafeApiPath(String(apiPath ?? ""));
      const query = parseQueryJson(queryJson);
      const response = await apiClient<unknown>(path, { method: "GET", query });
      return jsonForAgent(response);
    },

    /** Prefer this in the embedded ERP (uses the logged-in browser session). */
    listCrmLeads: async ({ q, status, limit, offset }) => {
      const query: Record<string, string | number> = {};
      if (q !== undefined && q !== "") query.q = String(q);
      if (status !== undefined && status !== "") query.status = String(status);
      if (limit !== undefined && limit !== "") query.limit = Number(limit);
      if (offset !== undefined && offset !== "") query.offset = Number(offset);
      const response = await apiClient<unknown>("/leads", { method: "GET", query });
      return jsonForAgent(response);
    },

    getCrmLead: async ({ leadId, id }) => {
      const lead = String(leadId ?? id ?? "").trim();
      if (!lead) return "leadId is required.";
      const response = await apiClient<unknown>(`/leads/${lead}`, { method: "GET" });
      return jsonForAgent(response);
    },

    getCurrentUser: async () => {
      const response = await apiClient<Record<string, unknown>>("/auth/me", { method: "GET" });
      return jsonForAgent(response.data ?? response);
    },

    navigateToCRM: () => {
      router.push("/crm");
      return "Navigated to the CRM workspace.";
    },

    showLead: async ({ leadId }) => {
      const id = String(leadId ?? "").trim();
      if (!id) return "leadId is required.";
      const lead = await fetchAgentLead(id);
      onLeadPreview?.(lead);
      router.push(`/crm/leads/${id}`);
      return `Opened lead ${leadDisplayName(lead)} (${lead.status}).`;
    },
  };

  return wrapClientTools(raw);
}
