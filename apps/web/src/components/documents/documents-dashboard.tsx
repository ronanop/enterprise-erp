"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  CheckSquare,
  FileText,
  FolderOpen,
  RefreshCw,
  Share2,
} from "lucide-react";

import { DocumentsPipelineFunnel } from "@/components/documents/documents-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  documentsQuickLinks,
  documentsWorkspaceGroups,
  resolveDocumentsGroupResources,
} from "@/config/documents";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  countOpenDocs,
  loadDocumentsOverview,
  type DocumentsOverview,
  type DocumentsRow,
} from "@/services/documents-service";

function recentDocuments(rows: DocumentsRow[], limit = 6): DocumentsRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.document_number ?? b.title ?? "").localeCompare(
        String(a.document_number ?? a.title ?? ""),
      ),
    )
    .slice(0, limit);
}

function classificationOf(row: DocumentsRow): string {
  const raw = row.classification_level ?? row.classification ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

export function DocumentsDashboard() {
  const [data, setData] = useState<DocumentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadDocumentsOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        libraryDocs: 0,
        pendingApprovals: 0,
        activeShares: 0,
        archives: 0,
      };
    }
    return {
      libraryDocs: data.documents.length,
      pendingApprovals: countByStatus(data.approvals, [
        "pending",
        "submitted",
        "in_review",
      ]),
      activeShares: countByStatus(data.shares, ["active", "approved"]),
      archives: data.archives.length,
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      documents: data?.documents.length ?? 0,
      "document-versions": data?.versions.length ?? 0,
      "document-approvals": data?.approvals.length ?? 0,
      "document-shares": data?.shares.length ?? 0,
      "retention-policies": data?.retentionPolicies.length ?? 0,
      archives: data?.archives.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentDocuments(data?.documents ?? []), [data]);

  const approvalQueue = useMemo(() => {
    const rows = data?.approvals ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.document_number ?? "").localeCompare(String(a.document_number ?? "")),
      )
      .slice(0, 5);
  }, [data]);

  const classificationMix = useMemo(() => {
    const rows = data?.documents ?? [];
    const stages = [
      { key: "public", label: "Public", barClass: "bg-slate-400" },
      { key: "internal", label: "Internal", barClass: "bg-sky-600" },
      { key: "confidential", label: "Confidential", barClass: "bg-teal-600" },
      { key: "restricted", label: "Restricted", barClass: "bg-amber-500" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = rows.filter((row) => classificationOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Document management — folders, versions, permissions, approvals, templates, retention, and archives."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/documents/documents"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <FileText className="size-3.5" />
              Documents
            </Link>
            <Link
              href="/documents/document-approvals"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Approvals
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live document data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some document endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Library documents"
          value={loading ? "—" : String(kpis.libraryDocs)}
          hint={`${data?.folders.length ?? 0} folders · ${countOpenDocs(data?.documents ?? [], ["archived", "disposed", "cancelled"])} active`}
          icon={FolderOpen}
          tone={kpis.libraryDocs > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Pending approvals"
          value={loading ? "—" : String(kpis.pendingApprovals)}
          hint={`${data?.approvals.length ?? 0} approvals · ${countByStatus(data?.workflows ?? [], ["active"])} workflows`}
          icon={CheckSquare}
          tone={kpis.pendingApprovals > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Active shares"
          value={loading ? "—" : String(kpis.activeShares)}
          hint={`${data?.shares.length ?? 0} shares · ${data?.permissions.length ?? 0} ACL rows`}
          icon={Share2}
          tone={kpis.activeShares > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Archives"
          value={loading ? "—" : String(kpis.archives)}
          hint={`${data?.retentionPolicies.length ?? 0} retention · ${data?.templates.length ?? 0} templates`}
          icon={Archive}
          tone={kpis.archives > 0 ? "success" : "default"}
        />
      </div>

      <DocumentsPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {documentsQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{documentsWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {documentsWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveDocumentsGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/documents/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent documents</h2>
              <p className="text-[11px] text-muted-foreground">Library intake</p>
            </div>
            <Link
              href="/documents/documents"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Document</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Class</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No documents yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.title ?? row.document_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.document_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.document_category ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(
                          row.classification_level ?? row.classification ?? "—",
                        ).replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Approval queue</h2>
              <p className="text-[11px] text-muted-foreground">Publish control</p>
            </div>
            <Link
              href="/documents/document-approvals"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : approvalQueue.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No approvals yet.
              </li>
            ) : (
              approvalQueue.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.approval_type ?? "approval").replaceAll("_", " ")} ·{" "}
                    {String(row.decision ?? "pending").replaceAll("_", " ")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Classification mix</h2>
            <p className="text-[11px] text-muted-foreground">FRD-19 §6 levels</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {classificationMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Versions {data?.versions.length ?? 0} · Tags {data?.tags.length ?? 0} · Templates{" "}
                {data?.templates.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
