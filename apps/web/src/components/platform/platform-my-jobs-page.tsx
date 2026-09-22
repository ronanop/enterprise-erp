"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  FolderKanban,
  Handshake,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isErpAdmin } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import {
  loadPlatformMyJobs,
  totalPlatformMyJobCount,
  type PlatformMyJobModuleSection,
} from "@/services/platform-my-jobs-service";

const MODULE_ICONS: Record<string, LucideIcon> = {
  crm: Handshake,
  projects: FolderKanban,
  hr: Users,
};

export function PlatformMyJobsPage() {
  const { moduleKeys, adminModuleKeys, user, loading: authLoading } = useAuthUser();
  const [sections, setSections] = useState<PlatformMyJobModuleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadPlatformMyJobs({
        moduleKeys,
        adminModuleKeys,
        isErpAdmin: isErpAdmin(user?.userType),
      });
      setSections(data);
    } catch (err) {
      setSections([]);
      setError(err instanceof Error ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [adminModuleKeys, moduleKeys, user?.userType]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const total = totalPlatformMyJobCount(sections);
  const withJobs = sections.filter((s) => s.jobs.length > 0);
  const withErrors = sections.filter((s) => s.error && s.jobs.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Jobs"
        description="Approvals and assigned work across every module you can access — one table per module."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5 transition-colors duration-200"
            onClick={() => void load()}
            disabled={loading || authLoading}
          >
            <RefreshCw
              className={cn("size-3.5", (loading || authLoading) && "animate-spin")}
              aria-hidden
            />
            Refresh
          </Button>
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

      {loading || authLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border/70 bg-muted/40 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : null}

      {!loading && !authLoading && !error && withJobs.length === 0 && withErrors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <Briefcase className="size-8 text-muted-foreground/70" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No jobs assigned</p>
            <p className="max-w-md text-sm text-muted-foreground">
              When CRM approvals, project delivery steps, or HR requests are assigned to you,
              they appear here grouped by module.
            </p>
          </div>
        </div>
      ) : null}

      {!loading && !authLoading && withJobs.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span> open job
          {total === 1 ? "" : "s"} across {withJobs.length} module
          {withJobs.length === 1 ? "" : "s"}
        </p>
      ) : null}

      <div className="space-y-6">
        {sections.map((section) => {
          if (section.jobs.length === 0 && !section.error) return null;
          const Icon = MODULE_ICONS[section.moduleKey] ?? Briefcase;
          return (
            <section
              key={section.moduleKey}
              className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]"
              aria-labelledby={`my-jobs-${section.moduleKey}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`my-jobs-${section.moduleKey}`}
                      className="truncate text-sm font-semibold tracking-tight text-foreground"
                    >
                      {section.moduleTitle}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {section.error
                        ? "Could not load"
                        : `${section.jobs.length} open job${section.jobs.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
                <Link
                  href={section.moduleHref}
                  className="cursor-pointer text-xs font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline"
                >
                  Open module
                </Link>
              </div>

              {section.error ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
                  {section.error}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Job</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Reference</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Detail</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold sm:px-5">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.jobs.map((job) => (
                        <tr
                          key={job.id}
                          className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium text-foreground sm:px-5">
                            {job.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground sm:px-5">
                            {job.reference || "—"}
                          </td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-muted-foreground sm:px-5">
                            {job.detail || "—"}
                          </td>
                          <td className="px-4 py-3 sm:px-5">
                            <FinanceStatusBadge status={job.status} />
                          </td>
                          <td className="px-4 py-3 text-right sm:px-5">
                            <Link
                              href={job.href}
                              className="inline-flex cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
