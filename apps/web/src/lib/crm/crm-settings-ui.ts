import type { CrmFieldConfig, CrmSettingsConfig } from "@/services/crm-settings-service";
import {
  fieldMapFromSettings,
  isFieldRequired,
  isFieldVisible,
  policyFlag,
} from "@/services/crm-settings-service";

export function formFieldsMap(
  settings: CrmSettingsConfig | null | undefined,
  entity: string,
): Record<string, CrmFieldConfig> {
  return fieldMapFromSettings(settings, entity);
}

export function fieldVisible(
  map: Record<string, CrmFieldConfig>,
  key: string,
  fallback = true,
): boolean {
  return isFieldVisible(map, key, fallback);
}

export function fieldRequired(
  map: Record<string, CrmFieldConfig>,
  key: string,
  fallback = false,
): boolean {
  return isFieldRequired(map, key, fallback);
}

/** Push label into missing when settings (or fallback) mark the field required and empty. */
export function pushRequired(
  missing: string[],
  map: Record<string, CrmFieldConfig>,
  key: string,
  label: string,
  empty: boolean,
  fallbackRequired: boolean,
): void {
  if (!fieldVisible(map, key, true)) return;
  if (fieldRequired(map, key, fallbackRequired) && empty) {
    missing.push(label);
  }
}

export function pageSectionVisible(
  settings: CrmSettingsConfig | null | undefined,
  pageKey: string,
  sectionKey: string,
  fallback = true,
): boolean {
  const sections = settings?.pages?.[pageKey]?.sections ?? [];
  const row = sections.find((s) => s.key === sectionKey);
  if (!row) return fallback;
  return row.visible !== false;
}

export function dashboardWidgetVisible(
  settings: CrmSettingsConfig | null | undefined,
  widgetKey: string,
  fallback = true,
): boolean {
  const widgets = settings?.dashboard?.widgets ?? [];
  const row = widgets.find((w) => w.key === widgetKey);
  if (!row) return fallback;
  return row.visible !== false;
}

export function policyEnabled(
  settings: CrmSettingsConfig | null | undefined,
  key: string,
  fallback = true,
): boolean {
  return policyFlag(settings, key, fallback);
}
