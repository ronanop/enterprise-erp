"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Table2,
  FormInput,
  PanelsTopLeft,
  GitBranch,
  ShieldCheck,
  Paperclip,
  BarChart3,
  SlidersHorizontal,
  RotateCcw,
  Settings,
  Save,
  ListTree,
  Plus,
  Trash2,
} from "lucide-react";

import { CrmCustomFieldsSection } from "@/components/crm/sales/crm-custom-fields-section";

import { CrmDefaultTaskOwnersPanel } from "@/components/crm/crm-default-task-owners-panel";
import { CrmCatalogsEditor } from "@/components/crm/settings/crm-catalogs-editor";
import { CrmFormFieldBuilder } from "@/components/crm/settings/crm-form-field-builder";
import { CrmErrorBanner, CrmPage, CrmSection } from "@/components/crm/crm-ui";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isErpAdmin } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { formatApiError } from "@/services/api-client";
import {
  customFormFields,
  getCrmSettingsDefaults,
  getCrmSettingsEffective,
  getCrmSettingsOverlay,
  policyBooleanFlags,
  policyRulesList,
  putCrmSettingsOverlay,
  putCrmSettingsSection,
  resetCrmSettings,
  type CrmColumnConfig,
  type CrmFieldConfig,
  type CrmPolicyRule,
  type CrmSettingsConfig,
} from "@/services/crm-settings-service";

export const CRM_SETTINGS_SECTIONS = [
  { key: "navigation", label: "Navigation & pages", icon: LayoutDashboard },
  { key: "tables", label: "Tables", icon: Table2 },
  { key: "forms", label: "Forms", icon: FormInput },
  { key: "catalogs", label: "Dropdowns", icon: ListTree },
  { key: "pages", label: "Detail layouts", icon: PanelsTopLeft },
  { key: "blueprint", label: "Sales flow", icon: GitBranch },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
  { key: "attachments", label: "Attachments", icon: Paperclip },
  { key: "dashboard", label: "Dashboard & analytics", icon: BarChart3 },
  { key: "policies", label: "Policies", icon: SlidersHorizontal },
  { key: "reset", label: "Reset / export", icon: RotateCcw },
] as const;

type SectionKey = (typeof CRM_SETTINGS_SECTIONS)[number]["key"];

const FORM_ENTITIES = ["lead", "company", "quote", "ovf", "contact", "kyc", "opportunity"] as const;
const TABLE_ENTITIES = ["company", "lead", "opportunity", "quote", "ovf", "contact", "kyc"] as const;

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/30">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function ResetSectionButton({
  sectionKey,
  disabled,
  onReset,
}: {
  sectionKey: SectionKey;
  disabled: boolean;
  onReset: (key: SectionKey) => void | Promise<void>;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 cursor-pointer gap-1.5"
      disabled={disabled}
      onClick={() => void onReset(sectionKey)}
    >
      <RotateCcw className="size-3.5" />
      Reset section
    </Button>
  );
}

function ColumnEditor({
  columns,
  onChange,
}: {
  columns: CrmColumnConfig[];
  onChange: (next: CrmColumnConfig[]) => void;
}) {
  return (
    <div className="space-y-2">
      {columns
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((col, idx) => (
          <div
            key={col.key}
            className="grid gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_auto_5rem]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{col.label}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{col.key}</p>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-primary"
                checked={col.visible !== false}
                onChange={(e) => {
                  const next = columns.map((c) =>
                    c.key === col.key ? { ...c, visible: e.target.checked } : c,
                  );
                  onChange(next);
                }}
              />
              Visible
            </label>
            <Input
              type="number"
              className="h-8"
              value={col.order ?? idx}
              onChange={(e) => {
                const order = Number(e.target.value);
                const next = columns.map((c) =>
                  c.key === col.key ? { ...c, order: Number.isFinite(order) ? order : 0 } : c,
                );
                onChange(next);
              }}
              aria-label={`Order for ${col.label}`}
            />
          </div>
        ))}
    </div>
  );
}

export function CrmSettingsPage() {
  const { user } = useAuthUser();
  const erpAdmin = isErpAdmin(user?.userType);
  const [section, setSection] = useState<SectionKey>("forms");
  const [config, setConfig] = useState<CrmSettingsConfig | null>(null);
  const [overlay, setOverlay] = useState<CrmSettingsConfig | null>(null);
  const [defaults, setDefaults] = useState<CrmSettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formEntity, setFormEntity] = useState<(typeof FORM_ENTITIES)[number]>("lead");
  const [tableEntity, setTableEntity] = useState<(typeof TABLE_ENTITIES)[number]>("company");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [effective, overlayRow, stock] = await Promise.all([
        getCrmSettingsEffective(),
        getCrmSettingsOverlay().catch(() => ({} as CrmSettingsConfig)),
        getCrmSettingsDefaults().catch(() => null),
      ]);
      setConfig(effective);
      setOverlay(overlayRow);
      setDefaults(stock);
    } catch (err) {
      setConfig(null);
      setOverlay(null);
      setError(formatApiError(err, "Failed to load CRM settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!erpAdmin) return;
    void load();
  }, [erpAdmin, load]);

  const formFields = useMemo(
    () => config?.forms?.[formEntity]?.fields ?? [],
    [config, formEntity],
  );
  const tableColumns = useMemo(
    () => config?.tables?.[tableEntity]?.columns ?? [],
    [config, tableEntity],
  );

  const customizedSections = useMemo(() => {
    if (!overlay || typeof overlay !== "object") return new Set<string>();
    return new Set(
      Object.keys(overlay).filter((k) => CRM_SETTINGS_SECTIONS.some((s) => s.key === k)),
    );
  }, [overlay]);

  const addableCustomColumns = useMemo(() => {
    const used = new Set(tableColumns.map((c) => c.key));
    return customFormFields(config, tableEntity).filter((f) => !used.has(f.key));
  }, [config, tableEntity, tableColumns]);

  async function saveSection(sectionKey: string, payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await putCrmSettingsSection(sectionKey, payload);
      setConfig(next);
      setOverlay(await getCrmSettingsOverlay().catch(() => ({} as CrmSettingsConfig)));
      setNotice(`Saved ${sectionKey}.`);
    } catch (err) {
      setError(formatApiError(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function onResetSection(sectionKey: SectionKey) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Reset the “${sectionKey}” section to stock defaults?`)
    ) {
      return;
    }
    const stock =
      defaults ?? (await getCrmSettingsDefaults().catch(() => null)) ?? ({} as CrmSettingsConfig);
    const payload = (stock as Record<string, unknown>)[sectionKey];
    if (!payload || typeof payload !== "object") {
      setError(`No stock defaults for section ${sectionKey}.`);
      return;
    }
    await saveSection(sectionKey, payload as Record<string, unknown>);
    setNotice(`Reset ${sectionKey} to defaults.`);
  }

  async function onReset() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Reset all CRM Settings to stock defaults? This cannot be undone.")
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setConfig(await resetCrmSettings());
      setOverlay({});
      setNotice("CRM Settings reset to defaults.");
    } catch (err) {
      setError(formatApiError(err, "Failed to reset settings"));
    } finally {
      setSaving(false);
    }
  }

  function downloadJson() {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm-settings-effective.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!erpAdmin) {
    return (
      <CrmPage>
        <PageHeader title="CRM Settings" />
        <CrmErrorBanner>Only ERP admins can open CRM Settings.</CrmErrorBanner>
      </CrmPage>
    );
  }

  return (
    <CrmPage>
      <PageHeader
        title="CRM Settings"
        description="Customize CRM navigation, forms, tables, flow, approvals, and policies for this tenant."
      />
      {error ? <CrmErrorBanner>{error}</CrmErrorBanner> : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="CRM settings sections"
          className="h-fit rounded-xl border border-border/80 bg-card p-2 shadow-sm"
        >
          {CRM_SETTINGS_SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            const customized = customizedSections.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                onClick={() => setSection(item.key)}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {customized ? (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                    Customized
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : null}

          {!loading && config && section === "navigation" ? (
            <CrmSection title="Navigation panes" icon={LayoutDashboard}>
              <div className="space-y-2">
                {(config.navigation?.panes ?? []).map((pane) => (
                  <ToggleRow
                    key={pane.key}
                    label={`${pane.title} (${pane.href})`}
                    hint={pane.erp_admin_only ? "ERP admin only" : undefined}
                    checked={pane.visible !== false}
                    onChange={(visible) => {
                      const panes = (config.navigation?.panes ?? []).map((p) =>
                        p.key === pane.key ? { ...p, visible } : p,
                      );
                      setConfig({ ...config, navigation: { panes } });
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("navigation", config.navigation ?? {})}
                >
                  <Save className="size-3.5" />
                  Save navigation
                </Button>
                <ResetSectionButton
                  sectionKey="navigation"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "tables" ? (
            <CrmSection title="List table columns" icon={Table2}>
              <div className="mb-3 flex flex-wrap gap-2">
                {TABLE_ENTITIES.map((entity) => (
                  <Button
                    key={entity}
                    type="button"
                    size="sm"
                    variant={tableEntity === entity ? "default" : "outline"}
                    className="h-8 cursor-pointer capitalize"
                    onClick={() => setTableEntity(entity)}
                  >
                    {entity}
                  </Button>
                ))}
              </div>
              {addableCustomColumns.length > 0 ? (
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer gap-1.5"
                    onClick={() => {
                      const field = addableCustomColumns[0];
                      if (!field || !config) return;
                      const maxOrder = tableColumns.reduce(
                        (m, c) => Math.max(m, c.order ?? 0),
                        -1,
                      );
                      const next: CrmColumnConfig[] = [
                        ...tableColumns,
                        {
                          key: field.key,
                          label: field.label,
                          visible: true,
                          order: maxOrder + 1,
                        },
                      ];
                      setConfig({
                        ...config,
                        tables: {
                          ...(config.tables ?? {}),
                          [tableEntity]: { columns: next },
                        },
                      });
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add custom column
                  </Button>
                </div>
              ) : null}
              <ColumnEditor
                columns={tableColumns}
                onChange={(columns) => {
                  setConfig({
                    ...config,
                    tables: {
                      ...(config.tables ?? {}),
                      [tableEntity]: { columns },
                    },
                  });
                }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("tables", config.tables ?? {})}
                >
                  <Save className="size-3.5" />
                  Save tables
                </Button>
                <ResetSectionButton
                  sectionKey="tables"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "forms" ? (
            <CrmSection title="Create / edit form fields" icon={FormInput}>
              <div className="mb-3 flex flex-wrap gap-2">
                {FORM_ENTITIES.map((entity) => (
                  <Button
                    key={entity}
                    type="button"
                    size="sm"
                    variant={formEntity === entity ? "default" : "outline"}
                    className="h-8 cursor-pointer capitalize"
                    onClick={() => setFormEntity(entity)}
                  >
                    {entity}
                  </Button>
                ))}
              </div>
              <CrmFormFieldBuilder
                fields={formFields}
                catalogKeys={Object.keys(config.catalogs ?? {})}
                onChange={(fields) => {
                  setConfig({
                    ...config,
                    forms: {
                      ...(config.forms ?? {}),
                      [formEntity]: { fields },
                    },
                  });
                }}
              />
              <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
                {formFields.filter((f) => f.visible !== false).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No visible fields for {formEntity}.</p>
                ) : (
                  <>
                    <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
                      {formFields
                        .filter((f) => f.visible !== false)
                        .slice()
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((f) => (
                          <li key={f.key} className="font-mono">
                            {f.label}{" "}
                            <span className="text-[10px] text-muted-foreground/80">({f.key})</span>
                          </li>
                        ))}
                    </ul>
                    <CrmCustomFieldsSection
                      entity={formEntity}
                      values={{}}
                      onChange={() => undefined}
                    />
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("forms", config.forms ?? {})}
                >
                  <Save className="size-3.5" />
                  Save forms
                </Button>
                <ResetSectionButton
                  sectionKey="forms"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "catalogs" ? (
            <CrmSection title="Dropdowns & picklists" icon={ListTree}>
              <p className="mb-3 text-sm text-muted-foreground">
                Edit option lists used by CRM forms. Disable stock options to hide them on new
                records; add custom options anytime.
              </p>
              <CrmCatalogsEditor
                catalogs={config.catalogs ?? {}}
                onChange={(catalogs) => setConfig({ ...config, catalogs })}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("catalogs", config.catalogs ?? {})}
                >
                  <Save className="size-3.5" />
                  Save dropdowns
                </Button>
                <ResetSectionButton
                  sectionKey="catalogs"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "pages" ? (
            <CrmSection title="Detail page sections" icon={PanelsTopLeft}>
              {Object.entries(config.pages ?? {}).map(([pageKey, page]) => (
                <div key={pageKey} className="mb-4 space-y-2">
                  <p className="text-sm font-semibold capitalize text-foreground">
                    {pageKey.replaceAll("_", " ")}
                  </p>
                  {(page.sections ?? []).map((sec) => (
                    <ToggleRow
                      key={sec.key}
                      label={sec.label}
                      checked={sec.visible !== false}
                      onChange={(visible) => {
                        const pages = { ...(config.pages ?? {}) };
                        pages[pageKey] = {
                          sections: (pages[pageKey]?.sections ?? []).map((s) =>
                            s.key === sec.key ? { ...s, visible } : s,
                          ),
                        };
                        setConfig({ ...config, pages });
                      }}
                    />
                  ))}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("pages", config.pages ?? {})}
                >
                  <Save className="size-3.5" />
                  Save detail layouts
                </Button>
                <ResetSectionButton sectionKey="pages" disabled={saving} onReset={onResetSection} />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "blueprint" ? (
            <CrmSection title="Sales flow rules & actions" icon={GitBranch}>
              <p className="mb-2 text-sm font-semibold text-foreground">Blueprint stages</p>
              <div className="mb-4 space-y-2">
                {(config.blueprint?.stages ?? []).map((stage) => (
                  <div
                    key={stage.key}
                    className="grid gap-2 rounded-lg border border-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                  >
                    <Input
                      className="h-8"
                      value={stage.label}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          blueprint: {
                            ...(config.blueprint ?? {}),
                            stages: (config.blueprint?.stages ?? []).map((s) =>
                              s.key === stage.key ? { ...s, label: e.target.value } : s,
                            ),
                          },
                        });
                      }}
                    />
                    <Input
                      type="number"
                      className="h-8"
                      value={stage.order ?? 0}
                      onChange={(e) => {
                        const order = Number(e.target.value);
                        setConfig({
                          ...config,
                          blueprint: {
                            ...(config.blueprint ?? {}),
                            stages: (config.blueprint?.stages ?? []).map((s) =>
                              s.key === stage.key
                                ? { ...s, order: Number.isFinite(order) ? order : 0 }
                                : s,
                            ),
                          },
                        });
                      }}
                      aria-label={`Order ${stage.key}`}
                    />
                    <p className="self-center font-mono text-[11px] text-muted-foreground">{stage.key}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {Object.entries(config.blueprint?.rules ?? {}).map(([key, value]) => (
                  <ToggleRow
                    key={key}
                    label={key.replaceAll("_", " ")}
                    checked={Boolean(value)}
                    onChange={(next) => {
                      setConfig({
                        ...config,
                        blueprint: {
                          ...(config.blueprint ?? {}),
                          rules: { ...(config.blueprint?.rules ?? {}), [key]: next },
                        },
                      });
                    }}
                  />
                ))}
                {Object.entries(config.blueprint?.actions ?? {}).map(([key, value]) => (
                  <ToggleRow
                    key={key}
                    label={`Action: ${key.replaceAll("_", " ")}`}
                    checked={value?.enabled !== false}
                    onChange={(enabled) => {
                      setConfig({
                        ...config,
                        blueprint: {
                          ...(config.blueprint ?? {}),
                          actions: {
                            ...(config.blueprint?.actions ?? {}),
                            [key]: { enabled },
                          },
                        },
                      });
                    }}
                  />
                ))}
              </div>
              <p className="mt-4 mb-2 text-sm font-semibold text-foreground">Transitions</p>
              <div className="mb-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer gap-1.5"
                  onClick={() => {
                    const transitions = [...(config.blueprint?.transitions ?? [])];
                    transitions.push({ from: "open", action: "attach_boq", to: "boq_pending" });
                    setConfig({
                      ...config,
                      blueprint: { ...(config.blueprint ?? {}), transitions },
                    });
                  }}
                >
                  <Plus className="size-3.5" />
                  Add transition
                </Button>
              </div>
              <div className="space-y-2">
                {(config.blueprint?.transitions ?? []).map((tr, idx) => (
                  <div
                    key={`${tr.from}-${tr.action}-${idx}`}
                    className="grid gap-2 rounded-lg border border-border/70 px-3 py-2 md:grid-cols-4"
                  >
                    {(["from", "action", "to"] as const).map((field) => (
                      <Input
                        key={field}
                        className="h-8"
                        placeholder={field}
                        value={String(tr[field] ?? "")}
                        onChange={(e) => {
                          const transitions = [...(config.blueprint?.transitions ?? [])];
                          transitions[idx] = { ...tr, [field]: e.target.value };
                          setConfig({
                            ...config,
                            blueprint: { ...(config.blueprint ?? {}), transitions },
                          });
                        }}
                      />
                    ))}
                    <Input
                      className="h-8"
                      placeholder="approval_step_key (optional)"
                      value={tr.approval_step_key ?? ""}
                      onChange={(e) => {
                        const transitions = [...(config.blueprint?.transitions ?? [])];
                        transitions[idx] = {
                          ...tr,
                          approval_step_key: e.target.value || undefined,
                        };
                        setConfig({
                          ...config,
                          blueprint: { ...(config.blueprint ?? {}), transitions },
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("blueprint", config.blueprint ?? {})}
                >
                  <Save className="size-3.5" />
                  Save sales flow
                </Button>
                <ResetSectionButton
                  sectionKey="blueprint"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && section === "approvals" ? (
            <div className="space-y-4">
              <CrmSection title="Approval steps" icon={ShieldCheck}>
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 cursor-pointer gap-1.5"
                    onClick={() => {
                      if (!config) return;
                      const steps = [...(config.approvals?.steps ?? [])];
                      const key = `cf_step_${steps.length + 1}`;
                      steps.push({
                        key,
                        label: "New approval step",
                        enabled: true,
                        team_role: "management",
                        source: "custom",
                      });
                      setConfig({ ...config, approvals: { steps } });
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add step
                  </Button>
                </div>
                <div className="space-y-2">
                  {(config?.approvals?.steps ?? []).map((step) => {
                    const deletable =
                      step.source === "custom" || step.key.startsWith("cf_");
                    return (
                    <div
                      key={step.key}
                      className="grid gap-2 rounded-lg border border-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_8rem_auto_auto]"
                    >
                      <Input
                        className="h-8"
                        value={step.label}
                        onChange={(e) => {
                          if (!config) return;
                          setConfig({
                            ...config,
                            approvals: {
                              steps: (config.approvals?.steps ?? []).map((s) =>
                                s.key === step.key ? { ...s, label: e.target.value } : s,
                              ),
                            },
                          });
                        }}
                      />
                      <Input
                        className="h-8"
                        value={step.team_role ?? "management"}
                        onChange={(e) => {
                          if (!config) return;
                          setConfig({
                            ...config,
                            approvals: {
                              steps: (config.approvals?.steps ?? []).map((s) =>
                                s.key === step.key ? { ...s, team_role: e.target.value } : s,
                              ),
                            },
                          });
                        }}
                      />
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={step.enabled !== false}
                          onChange={(e) => {
                            if (!config) return;
                            setConfig({
                              ...config,
                              approvals: {
                                steps: (config.approvals?.steps ?? []).map((s) =>
                                  s.key === step.key ? { ...s, enabled: e.target.checked } : s,
                                ),
                              },
                            });
                          }}
                        />
                        Enabled
                      </label>
                      {deletable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 cursor-pointer text-destructive"
                          aria-label={`Delete step ${step.key}`}
                          onClick={() => {
                            if (!config) return;
                            setConfig({
                              ...config,
                              approvals: {
                                steps: (config.approvals?.steps ?? []).filter(
                                  (s) => s.key !== step.key,
                                ),
                              },
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-9 cursor-pointer gap-1.5"
                    disabled={saving || !config}
                    onClick={() => void saveSection("approvals", config?.approvals ?? {})}
                  >
                    <Save className="size-3.5" />
                    Save approval steps
                  </Button>
                  <ResetSectionButton
                    sectionKey="approvals"
                    disabled={saving}
                    onReset={onResetSection}
                  />
                </div>
              </CrmSection>
              <CrmDefaultTaskOwnersPanel />
            </div>
          ) : null}

          {!loading && config && section === "attachments" ? (
            <CrmSection title="Attachment policies" icon={Paperclip}>
              <div className="space-y-2">
                {(config.attachments?.policies ?? []).map((pol) => (
                  <ToggleRow
                    key={pol.key}
                    label={`${pol.label} (${pol.entity})`}
                    hint={
                      pol.when
                        ? `Conditional: ${JSON.stringify(pol.when)}`
                        : pol.required
                          ? "Required"
                          : "Optional"
                    }
                    checked={Boolean(pol.required)}
                    onChange={(required) => {
                      setConfig({
                        ...config,
                        attachments: {
                          policies: (config.attachments?.policies ?? []).map((p) =>
                            p.key === pol.key ? { ...p, required } : p,
                          ),
                        },
                      });
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("attachments", config.attachments ?? {})}
                >
                  <Save className="size-3.5" />
                  Save attachments
                </Button>
                <ResetSectionButton
                  sectionKey="attachments"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "dashboard" ? (
            <CrmSection title="Dashboard widgets" icon={BarChart3}>
              <div className="mb-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer gap-1.5"
                  onClick={() => {
                    const widgets = [...(config.dashboard?.widgets ?? [])];
                    widgets.push({
                      key: `cf_widget_${widgets.length + 1}`,
                      label: "Custom widget",
                      visible: true,
                      order: widgets.length,
                      type: "kpi",
                      source: "stock_metric",
                    });
                    setConfig({ ...config, dashboard: { widgets } });
                  }}
                >
                  <Plus className="size-3.5" />
                  Add widget
                </Button>
              </div>
              <div className="space-y-2">
                {(config.dashboard?.widgets ?? []).map((w) => (
                  <div
                    key={w.key}
                    className="grid gap-2 rounded-lg border border-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                  >
                    <Input
                      className="h-8"
                      value={w.label}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dashboard: {
                            widgets: (config.dashboard?.widgets ?? []).map((row) =>
                              row.key === w.key ? { ...row, label: e.target.value } : row,
                            ),
                          },
                        })
                      }
                    />
                    <select
                      className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                      value={w.type ?? "kpi"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dashboard: {
                            widgets: (config.dashboard?.widgets ?? []).map((row) =>
                              row.key === w.key ? { ...row, type: e.target.value } : row,
                            ),
                          },
                        })
                      }
                    >
                      <option value="kpi">KPI</option>
                      <option value="list">List</option>
                      <option value="chart">Chart</option>
                    </select>
                    <select
                      className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
                      value={w.source ?? "stock_metric"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dashboard: {
                            widgets: (config.dashboard?.widgets ?? []).map((row) =>
                              row.key === w.key ? { ...row, source: e.target.value } : row,
                            ),
                          },
                        })
                      }
                    >
                      <option value="stock_metric">Stock metric</option>
                      <option value="saved_report">Saved report</option>
                    </select>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={w.visible !== false}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dashboard: {
                              widgets: (config.dashboard?.widgets ?? []).map((row) =>
                                row.key === w.key ? { ...row, visible: e.target.checked } : row,
                              ),
                            },
                          })
                        }
                      />
                      Visible
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void saveSection("dashboard", config.dashboard ?? {})}
                >
                  <Save className="size-3.5" />
                  Save dashboard
                </Button>
                <ResetSectionButton
                  sectionKey="dashboard"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && config && section === "policies" ? (
            <CrmSection title="Mechanisms & policies" icon={SlidersHorizontal}>
              <p className="mb-2 text-xs text-muted-foreground">Boolean flags</p>
              <div className="space-y-2">
                {Object.entries(policyBooleanFlags(config.policies)).map(([key, value]) => (
                  <ToggleRow
                    key={key}
                    label={key.replaceAll("_", " ")}
                    checked={Boolean(value)}
                    onChange={(next) => {
                      const policies = config.policies;
                      const rules = policyRulesList(policies);
                      if (Array.isArray((policies as { rules?: CrmPolicyRule[] })?.rules)) {
                        const flags = {
                          ...policyBooleanFlags(policies),
                          [key]: next,
                        };
                        setConfig({
                          ...config,
                          policies: { flags, rules },
                        });
                        return;
                      }
                      setConfig({
                        ...config,
                        policies: {
                          ...policyBooleanFlags(policies),
                          [key]: next,
                        },
                      });
                    }}
                  />
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Named rules (optional)</p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 cursor-pointer gap-1.5"
                    onClick={() => {
                      const rules = policyRulesList(config.policies);
                      const nextRule: CrmPolicyRule = {
                        key: `policy_${rules.length + 1}`,
                        label: "New policy rule",
                        enabled: true,
                        expression: { entity_status_equals: "open" },
                      };
                      const flags = policyBooleanFlags(config.policies);
                      setConfig({
                        ...config,
                        policies: { flags, rules: [...rules, nextRule] },
                      });
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add rule
                  </Button>
                </div>
                <div className="space-y-2">
                  {policyRulesList(config.policies).map((rule, idx) => (
                    <div
                      key={rule.key}
                      className="grid gap-2 rounded-lg border border-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
                    >
                      <Input
                        className="h-8"
                        value={rule.key}
                        onChange={(e) => {
                          const rules = [...policyRulesList(config.policies)];
                          rules[idx] = { ...rule, key: e.target.value };
                          setConfig({
                            ...config,
                            policies: { flags: policyBooleanFlags(config.policies), rules },
                          });
                        }}
                      />
                      <Input
                        className="h-8 font-mono text-xs"
                        value={JSON.stringify(rule.expression ?? {})}
                        onChange={(e) => {
                          try {
                            const expression = JSON.parse(e.target.value) as Record<string, unknown>;
                            const rules = [...policyRulesList(config.policies)];
                            rules[idx] = { ...rule, expression };
                            setConfig({
                              ...config,
                              policies: { flags: policyBooleanFlags(config.policies), rules },
                            });
                          } catch {
                            /* wait for valid JSON */
                          }
                        }}
                      />
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={rule.enabled !== false}
                          onChange={(e) => {
                            const rules = [...policyRulesList(config.policies)];
                            rules[idx] = { ...rule, enabled: e.target.checked };
                            setConfig({
                              ...config,
                              policies: { flags: policyBooleanFlags(config.policies), rules },
                            });
                          }}
                        />
                        On
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() =>
                    void saveSection(
                      "policies",
                      (config.policies as Record<string, unknown>) ?? {},
                    )
                  }
                >
                  <Save className="size-3.5" />
                  Save policies
                </Button>
                <ResetSectionButton
                  sectionKey="policies"
                  disabled={saving}
                  onReset={onResetSection}
                />
              </div>
            </CrmSection>
          ) : null}

          {!loading && section === "reset" ? (
            <CrmSection title="Reset / export / import" icon={RotateCcw}>
              <p className="text-sm text-muted-foreground">
                Download the effective merged config, import an overlay JSON, or restore stock CRM
                defaults for this tenant.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9 cursor-pointer" onClick={downloadJson}>
                  Export JSON
                </Button>
                <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-muted/40">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        void (async () => {
                          try {
                            const parsed = JSON.parse(String(reader.result ?? "{}")) as Record<
                              string,
                              unknown
                            >;
                            setSaving(true);
                            setConfig(await putCrmSettingsOverlay(parsed));
                            setNotice("Imported settings overlay.");
                          } catch (err) {
                            setError(formatApiError(err, "Failed to import settings"));
                          } finally {
                            setSaving(false);
                          }
                        })();
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 cursor-pointer gap-1.5"
                  disabled={saving}
                  onClick={() => void onReset()}
                >
                  <RotateCcw className="size-3.5" />
                  Reset to defaults
                </Button>
              </div>
            </CrmSection>
          ) : null}
        </div>
      </div>
    </CrmPage>
  );
}

export function CrmSettingsIcon() {
  return <Settings className="size-4" />;
}
