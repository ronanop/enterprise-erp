import { QUOTE_SERVICE_TYPES } from "@/lib/crm/lead-product-options";
import { apiClient } from "@/services/api-client";

export const CRM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "email",
  "phone",
  "select",
  "multiselect",
  "checkbox",
  "url",
] as const;

export type CrmFieldType = (typeof CRM_FIELD_TYPES)[number];

export type CrmFieldConfig = {
  key: string;
  label: string;
  type?: CrmFieldType | string;
  source?: "stock" | "custom" | string;
  visible?: boolean;
  required?: boolean;
  order?: number;
  catalog_key?: string | null;
  options?: Array<{ value: string; label: string }>;
  when?: Record<string, unknown> | null;
  placeholder?: string;
  help_text?: string;
};

export type CrmColumnConfig = {
  key: string;
  label: string;
  visible?: boolean;
  order?: number;
};

export type CrmCatalogOption = {
  value: string;
  label: string;
  enabled?: boolean;
  order?: number;
  source?: "stock" | "custom" | string;
  meta?: { parent_value?: string; [key: string]: unknown };
};

export type CrmCatalogConfig = {
  label?: string;
  allow_custom_values?: boolean;
  options?: CrmCatalogOption[];
};

export type CrmDashboardWidget = {
  key: string;
  label: string;
  visible?: boolean;
  order?: number;
  type?: "kpi" | "list" | "chart" | string;
  source?: "stock_metric" | "saved_report" | string;
  report_id?: string | null;
};

export type CrmPolicyRule = {
  key: string;
  label?: string;
  enabled?: boolean;
  expression?: Record<string, unknown> | null;
};

export type CrmApprovalStep = {
  key: string;
  label: string;
  enabled?: boolean;
  team_role?: string;
  source?: "stock" | "custom" | string;
};

export type CrmSettingsConfig = {
  navigation?: {
    panes?: Array<{
      key: string;
      title: string;
      href: string;
      visible?: boolean;
      order?: number;
      erp_admin_only?: boolean;
    }>;
  };
  tables?: Record<string, { columns?: CrmColumnConfig[] }>;
  forms?: Record<string, { fields?: CrmFieldConfig[] }>;
  catalogs?: Record<string, CrmCatalogConfig>;
  pages?: Record<
    string,
    { sections?: Array<{ key: string; label: string; visible?: boolean; order?: number }> }
  >;
  blueprint?: {
    stages?: Array<{ key: string; label: string; order?: number }>;
    rules?: Record<string, boolean>;
    actions?: Record<string, { enabled?: boolean }>;
    transitions?: Array<{ from: string; action: string; to: string; approval_step_key?: string }>;
  };
  approvals?: {
    steps?: CrmApprovalStep[];
  };
  attachments?: {
    policies?: Array<{
      key: string;
      label: string;
      entity: string;
      required?: boolean;
      when?: Record<string, unknown> | null;
      allowed_types?: string[];
    }>;
  };
  dashboard?: {
    widgets?: CrmDashboardWidget[];
  };
  policies?: Record<string, boolean> | { rules?: CrmPolicyRule[]; flags?: Record<string, boolean> };
};

export type CrmSettingsMeta = {
  has_overlay: boolean;
  config_version: number;
  updated_at: string | null;
  sections: string[];
};

export async function getCrmSettingsEffective(): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>("/crm/settings/effective");
  return (res.data ?? {}) as CrmSettingsConfig;
}

export async function getCrmSettingsOverlay(): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>("/crm/settings");
  return (res.data ?? {}) as CrmSettingsConfig;
}

export async function getCrmSettingsMeta(): Promise<CrmSettingsMeta> {
  const res = await apiClient<CrmSettingsMeta>("/crm/settings/meta");
  if (!res.data) throw new Error(res.message || "Failed to load settings meta");
  return res.data;
}

export async function getCrmSettingsDefaults(): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>("/crm/settings/defaults");
  return (res.data ?? {}) as CrmSettingsConfig;
}

export async function putCrmSettingsSection(
  section: string,
  payload: Record<string, unknown>,
): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>(`/crm/settings/sections/${section}`, {
    method: "PUT",
    body: { section: payload },
  });
  return (res.data ?? {}) as CrmSettingsConfig;
}

export async function putCrmSettingsOverlay(
  overlay: Record<string, unknown>,
): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>("/crm/settings/overlay", {
    method: "PUT",
    body: { overlay },
  });
  return (res.data ?? {}) as CrmSettingsConfig;
}

export async function resetCrmSettings(): Promise<CrmSettingsConfig> {
  const res = await apiClient<CrmSettingsConfig>("/crm/settings/reset", { method: "POST" });
  return (res.data ?? {}) as CrmSettingsConfig;
}

export function fieldMapFromSettings(
  settings: CrmSettingsConfig | null | undefined,
  entity: string,
): Record<string, CrmFieldConfig> {
  const fields = settings?.forms?.[entity]?.fields ?? [];
  const out: Record<string, CrmFieldConfig> = {};
  for (const f of fields) {
    if (f?.key) out[f.key] = f;
  }
  return out;
}

export function isFieldVisible(
  map: Record<string, CrmFieldConfig>,
  key: string,
  fallback = true,
): boolean {
  const row = map[key];
  if (!row) return fallback;
  return row.visible !== false;
}

export function isFieldRequired(
  map: Record<string, CrmFieldConfig>,
  key: string,
  fallback = false,
): boolean {
  const row = map[key];
  if (!row) return fallback;
  return Boolean(row.required);
}

export function visibleTableColumns(
  settings: CrmSettingsConfig | null | undefined,
  entity: string,
): CrmColumnConfig[] {
  const cols = settings?.tables?.[entity]?.columns ?? [];
  return [...cols]
    .filter((c) => c.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function catalogOptions(
  settings: CrmSettingsConfig | null | undefined,
  catalogKey: string,
  parentValue?: string | null,
): CrmCatalogOption[] {
  const options = settings?.catalogs?.[catalogKey]?.options ?? [];
  return [...options]
    .filter((o) => o.enabled !== false)
    .filter((o) => {
      if (!parentValue) return true;
      return String(o.meta?.parent_value ?? "") === parentValue;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function customFormFields(
  settings: CrmSettingsConfig | null | undefined,
  entity: string,
): CrmFieldConfig[] {
  const fields = settings?.forms?.[entity]?.fields ?? [];
  return [...fields]
    .filter((f) => f.source === "custom" || f.key.startsWith("cf_"))
    .filter((f) => f.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function quoteServiceTypeOptions(
  settings: CrmSettingsConfig | null | undefined,
): string[] {
  const opts = catalogOptions(settings, "product_types");
  const fromCatalog = opts.map((o) => o.value).filter((v) => v && v !== "Others");
  if (fromCatalog.length) return fromCatalog;
  return [...QUOTE_SERVICE_TYPES];
}

export function catalogOptionLabels(
  settings: CrmSettingsConfig | null | undefined,
  catalogKey: string,
  fallback: string[],
): string[] {
  const opts = catalogOptions(settings, catalogKey);
  if (opts.length === 0) return fallback;
  return opts.map((o) => o.label || o.value);
}

export function orderedDashboardWidgets(
  settings: CrmSettingsConfig | null | undefined,
): CrmDashboardWidget[] {
  return [...(settings?.dashboard?.widgets ?? [])]
    .filter((w) => w.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function policyBooleanFlags(
  policies: CrmSettingsConfig["policies"],
): Record<string, boolean> {
  if (!policies || typeof policies !== "object") return {};
  const rules = (policies as { rules?: CrmPolicyRule[] }).rules;
  if (Array.isArray(rules)) {
    const flags = (policies as { flags?: Record<string, boolean> }).flags ?? {};
    return { ...flags };
  }
  return { ...(policies as Record<string, boolean>) };
}

export function policyRulesList(
  policies: CrmSettingsConfig["policies"],
): CrmPolicyRule[] {
  if (!policies || typeof policies !== "object") return [];
  const rules = (policies as { rules?: CrmPolicyRule[] }).rules;
  return Array.isArray(rules) ? [...rules] : [];
}

export function policyFlag(
  settings: CrmSettingsConfig | null | undefined,
  key: string,
  fallback = true,
): boolean {
  const policies = settings?.policies;
  if (!policies) return fallback;
  if (Array.isArray((policies as { rules?: CrmPolicyRule[] }).rules)) {
    const rules = (policies as { rules: CrmPolicyRule[] }).rules;
    const row = rules.find((r) => r.key === key);
    if (row) return row.enabled !== false;
    const flags = (policies as { flags?: Record<string, boolean> }).flags;
    if (flags && key in flags) return Boolean(flags[key]);
    return fallback;
  }
  if (typeof policies === "object" && key in (policies as Record<string, boolean>)) {
    return Boolean((policies as Record<string, boolean>)[key]);
  }
  const rules = settings?.blueprint?.rules;
  if (rules && key in rules) return Boolean(rules[key]);
  return fallback;
}
