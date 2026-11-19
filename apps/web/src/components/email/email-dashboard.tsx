"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Mail,
  MailWarning,
  PenSquare,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";

import { EmailWorkspaceNav } from "@/components/email/email-workspace-nav";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import {
  loadEmailOverview,
  testEmailConnection,
  type EmailOverview,
} from "@/services/email-notification-service";
import { ApiClientError } from "@/services/api-client";

function statusTone(status: string): "default" | "success" | "warning" | "danger" {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "sent") return "success";
  if (s === "failed") return "danger";
  if (s === "queued" || s === "pending" || s === "retrying") return "warning";
  return "default";
}

export function EmailDashboard() {
  const [data, setData] = useState<EmailOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testDetails, setTestDetails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = not yet mounted (avoid SSR/client auth mismatch)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadEmailOverview());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load email overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  useEffect(() => {
    if (authenticated) void load();
    else if (authenticated === false) setLoading(false);
  }, [authenticated, load]);

  async function onTestConnection() {
    setTesting(true);
    setTestMessage(null);
    setTestOk(null);
    setTestDetails([]);
    try {
      const result = await testEmailConnection();
      if (!result) {
        setTestOk(false);
        setTestMessage("Failed — no response from server");
        setTestDetails([]);
        return;
      }
      setTestOk(result.ok);
      setTestMessage(result.ok ? `OK — ${result.message}` : `Failed — ${result.message}`);
      const lines: string[] = [];
      if (result.status_code) lines.push(`HTTP / status: ${result.status_code}`);
      if (result.from_email) lines.push(`From mailbox: ${result.from_email}`);
      if (result.provider_response) lines.push(`Provider: ${result.provider_response}`);
      const d = result.details ?? result.diagnostics;
      if (d) {
        if ("step" in d && d.step) lines.push(`Failed step: ${d.step}`);
        if (d.missing?.length) lines.push(`Missing env: ${d.missing.join(", ")}`);
        if (d.present?.length) lines.push(`Present env: ${d.present.join(", ")}`);
        if (d.tenant_id_preview) lines.push(`Tenant ID: ${d.tenant_id_preview}`);
        if (d.client_id_preview) lines.push(`Client ID: ${d.client_id_preview}`);
        if (d.env_files_found?.length) {
          lines.push(`Env files loaded: ${d.env_files_found.join(" | ")}`);
        } else if (d.env_files_found) {
          lines.push("Env files loaded: (none found — check apps/api/.env)");
        }
        if (d.hint) lines.push(`Hint: ${d.hint}`);
      }
      if (!result.ok && lines.length === 0) {
        lines.push("No extra diagnostics returned. Restart the API after updating apps/api/.env.");
      }
      setTestDetails(lines);
      await load();
    } catch (err) {
      setTestOk(false);
      const msg = err instanceof ApiClientError ? err.message : "Connection test failed";
      setTestMessage(`Failed — ${msg}`);
      const lines = [`Error: ${msg}`];
      if (err instanceof ApiClientError) {
        lines.push(`HTTP status: ${err.status}`);
        if (err.errors?.length) lines.push(...err.errors.map((e) => `• ${e}`));
      }
      setTestDetails(lines);
    } finally {
      setTesting(false);
    }
  }

  const provider = data?.provider;
  const counts = data?.counts;

  return (
    <div className="space-y-5">
      <EmailWorkspaceNav />
      <PageHeader
        title="Email Notifications"
        description="Microsoft Graph delivery through the Foundation Notification Engine."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-opacity duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-opacity duration-200"
              onClick={() => void onTestConnection()}
              disabled={testing || authenticated !== true}
            >
              <Server className="size-3.5" />
              {testing ? "Testing…" : "Test Graph"}
            </Button>
            <Link
              href="/email/compose"
              className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-opacity duration-200 hover:bg-primary/80"
            >
              <PenSquare className="size-3.5" />
              Compose
            </Link>
          </div>
        }
      />

      {authenticated === false ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sign in to load live email data.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {testMessage ? (
        <div
          className={
            testOk
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"
              : "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-foreground"
          }
        >
          <p className="font-medium">{testMessage}</p>
          {testDetails.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {testDetails.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Delivered"
          value={String(counts?.delivered ?? 0)}
          hint="Successful Graph sends"
          icon={CheckCircle2}
          tone="success"
        />
        <FinanceKpiCard
          label="Failed"
          value={String(counts?.failed ?? 0)}
          hint="Delivery failures"
          icon={XCircle}
          tone="danger"
        />
        <FinanceKpiCard
          label="Queued"
          value={String(counts?.queued ?? 0)}
          hint="Pending events"
          icon={MailWarning}
          tone="warning"
        />
        <FinanceKpiCard
          label="Templates"
          value={String(counts?.email_templates ?? 0)}
          hint="Email channel templates"
          icon={Mail}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium text-foreground">Graph provider</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={provider?.configured ? "default" : "secondary"}>
                  {provider?.configured ? "Configured" : "Not configured"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-mono text-xs text-foreground">{provider?.from_email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Delivery mode</dt>
              <dd className="text-foreground">{provider?.delivery_mode ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Tenant / Client / Secret</dt>
              <dd className="text-xs text-muted-foreground">
                {[provider?.tenant_id_set, provider?.client_id_set, provider?.client_secret_set]
                  .map((v) => (v ? "✓" : "✗"))
                  .join(" / ")}
              </dd>
            </div>
            {provider?.diagnostics?.missing?.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                <p className="font-medium">Missing: {provider.diagnostics.missing.join(", ")}</p>
                {provider.diagnostics.hint ? (
                  <p className="mt-1 text-[11px] text-amber-900/80">{provider.diagnostics.hint}</p>
                ) : null}
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Recent deliveries</h2>
            <Link
              href="/email/deliveries"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border/60">
            {(data?.recent_deliveries ?? []).slice(0, 6).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {row.subject || row.event_type || "Email"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.recipient_address ?? "—"}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 tone-${statusTone(row.status)}`}>
                  {row.status}
                </Badge>
              </li>
            ))}
            {!loading && (data?.recent_deliveries?.length ?? 0) === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No deliveries yet.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
