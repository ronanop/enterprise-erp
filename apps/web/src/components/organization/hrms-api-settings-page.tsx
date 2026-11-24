"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Cable, RefreshCw, Save, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { WorkspacePage, WorkspaceSection } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isErpAdmin } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  getHrmsIntegrationSettings,
  saveHrmsIntegrationSettings,
  syncHrmsIntegration,
  testHrmsIntegration,
  type HrmsIntegrationSettings,
  type HrmsIntegrationSyncResult,
  type HrmsIntegrationTestResult,
} from "@/services/hrms-integration-service";

const DEFAULT_BASE_URL = "http://172.16.110.15:3000";
const DEFAULT_PATH = "/api/v1/hr/integration/employees";

export function HrmsApiSettingsPage() {
  const { user, loading: authLoading } = useAuthUser();
  const erpAdmin = isErpAdmin(user?.userType);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [employeesPath, setEmployeesPath] = useState(DEFAULT_PATH);
  const [pageSize, setPageSize] = useState(100);
  const [apiKey, setApiKey] = useState("");
  const [savedApiKey, setSavedApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");

  const [testResult, setTestResult] = useState<HrmsIntegrationTestResult | null>(null);
  const [syncResult, setSyncResult] = useState<HrmsIntegrationSyncResult | null>(null);

  const applySettings = useCallback((settings: HrmsIntegrationSettings) => {
    setBaseUrl(settings.base_url || DEFAULT_BASE_URL);
    setEmployeesPath(settings.employees_path || DEFAULT_PATH);
    setPageSize(settings.page_size || 100);
    setHasApiKey(settings.has_api_key);
    setApiKeyMasked(settings.api_key_masked || "");
    setSavedApiKey(settings.api_key || "");
    setApiKey("");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applySettings(await getHrmsIntegrationSettings());
    } catch (err) {
      setError(formatApiError(err, "Failed to load HRMS API settings"));
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    if (!erpAdmin) return;
    void load();
  }, [erpAdmin, load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveHrmsIntegrationSettings({
        base_url: baseUrl.trim(),
        employees_path: employeesPath.trim() || DEFAULT_PATH,
        page_size: pageSize,
        api_key: apiKey.trim() || null,
      });
      applySettings(saved);
      setNotice("API settings saved.");
    } catch (err) {
      setError(formatApiError(err, "Could not save API settings"));
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    if (testing) return;
    setTesting(true);
    setError(null);
    setNotice(null);
    setTestResult(null);
    try {
      const result = await testHrmsIntegration();
      setTestResult(result);
      setNotice(
        result.ok
          ? `Connected · ${result.total} employees available`
          : result.message || "Connection failed",
      );
    } catch (err) {
      setError(formatApiError(err, "Connection test failed"));
    } finally {
      setTesting(false);
    }
  }

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    setSyncResult(null);
    try {
      const result = await syncHrmsIntegration();
      setSyncResult(result);
      const loginChanges = result.created + result.linked + result.updated;
      const loginSummary =
        loginChanges > 0
          ? `logins +${result.created}/linked ${result.linked}/updated ${result.updated}`
          : `logins already in users (${result.employee_count})`;
      setNotice(
        `Fetched ${result.fetched} · employees +${result.employees_created}/~${result.employees_updated} · ${loginSummary}.`,
      );
    } catch (err) {
      setError(formatApiError(err, "Employee sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <WorkspacePage>
        <PageHeader
          title="HRMS API settings"
          description="Loading…"
          backHref="/organization/users"
          backLabel="Users"
        />
      </WorkspacePage>
    );
  }

  if (!erpAdmin) {
    return (
      <WorkspacePage>
        <PageHeader
          title="HRMS API settings"
          description="Platform and tenant administrators only."
          backHref="/organization/users"
          backLabel="Users"
        />
        <WorkspaceSection title="Access restricted" icon={ShieldCheck}>
          <Button asChild className="cursor-pointer transition-colors duration-200">
            <Link href="/admin-login">Admin sign-in</Link>
          </Button>
        </WorkspaceSection>
      </WorkspacePage>
    );
  }

  const curlExample = `curl -s -H "X-HRMS-Api-Key: ${apiKey.trim() || savedApiKey || "<api-key>"}" "${baseUrl.trim().replace(/\/$/, "")}${employeesPath.trim() || DEFAULT_PATH}?page=1&page_size=${pageSize}"`;

  return (
    <WorkspacePage>
      <PageHeader
        title="HRMS API settings"
        description="Configure the remote HRMS employee integration used to fetch and sync users."
        backHref="/organization/users"
        backLabel="Users"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={testing || saving || syncing || !hasApiKey}
              onClick={() => void onTest()}
            >
              <Cable className={`size-3.5 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button
              type="button"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={syncing || saving || testing || !hasApiKey}
              onClick={() => void onSync()}
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
              {syncing ? "Syncing…" : "Fetch & sync employees"}
            </Button>
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      <WorkspaceSection
        title="Connection"
        subtitle="Remote HRMS host, API key header, and employees endpoint."
        icon={Cable}
      >
        <form className="space-y-4" onSubmit={(e) => void onSave(e)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hrms-base-url">Base URL</Label>
              <Input
                id="hrms-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
                className="h-10 transition-colors duration-200"
                required
              />
              <p className="text-xs text-muted-foreground">Example: http://172.16.110.15:3000</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hrms-employees-path">Employees path</Label>
              <Input
                id="hrms-employees-path"
                value={employeesPath}
                onChange={(e) => setEmployeesPath(e.target.value)}
                placeholder={DEFAULT_PATH}
                className="h-10 font-mono text-sm transition-colors duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hrms-api-key">API key (X-HRMS-Api-Key)</Label>
              <Input
                id="hrms-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? `Saved · ${apiKeyMasked}` : "hrms_…"}
                className="h-10 font-mono text-sm transition-colors duration-200"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the saved key. Paste a new key to rotate it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hrms-page-size">Page size</Label>
              <Input
                id="hrms-page-size"
                type="number"
                min={1}
                max={500}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 100)}
                className="h-10 transition-colors duration-200"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">curl preview</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
              {curlExample}
            </pre>
          </div>

          <Button
            type="submit"
            className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
            disabled={saving || !baseUrl.trim() || (!hasApiKey && !apiKey.trim())}
          >
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </WorkspaceSection>

      {testResult ? (
        <WorkspaceSection
          title="Connection test"
          subtitle={testResult.message}
          badge={testResult.ok ? "OK" : "Failed"}
          icon={Cable}
        >
          <p className="text-sm text-muted-foreground">
            HTTP {testResult.status_code} · total {testResult.total} · sample {testResult.sample_count}
          </p>
          {testResult.sample.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/60 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testResult.sample.map((row, idx) => (
                    <tr key={`${row.employee_code ?? "row"}-${idx}`} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono">{row.employee_code ?? "—"}</td>
                      <td className="px-3 py-2">{row.name ?? "—"}</td>
                      <td className="px-3 py-2">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.department ?? "—"}</td>
                      <td className="px-3 py-2">{row.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </WorkspaceSection>
      ) : null}

      {syncResult ? (
        <WorkspaceSection title="Last sync" subtitle="Remote fetch + local login sync" icon={RefreshCw}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Fetched</dt>
              <dd className="font-semibold tabular-nums">{syncResult.fetched}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Employees created / updated</dt>
              <dd className="font-semibold tabular-nums">
                {syncResult.employees_created} / {syncResult.employees_updated}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Logins created / linked</dt>
              <dd className="font-semibold tabular-nums">
                {syncResult.created} / {syncResult.linked}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Onboarded employees</dt>
              <dd className="font-semibold tabular-nums">{syncResult.employee_count}</dd>
            </div>
          </dl>
        </WorkspaceSection>
      ) : null}
    </WorkspacePage>
  );
}
