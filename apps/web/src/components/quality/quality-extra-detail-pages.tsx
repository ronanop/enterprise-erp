"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ModuleCrossLink,
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  getQualityAudit,
  getQualityComplaint,
  getQualityDefect,
  getQualitySupplierScore,
  linkDefectToNcr,
  listQualityNcrs,
  loadQmOptions,
  qualityAuditAction,
  qualityComplaintAction,
  qualitySupplierScoreAction,
  type QualityAudit,
  type QualityComplaint,
  type QualityDefect,
  type QualitySupplierScore,
  type QmOption,
} from "@/services/quality-service";

export function DefectDetailPage({ defectId }: { defectId: string }) {
  const [row, setRow] = useState<QualityDefect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ncrOptions, setNcrOptions] = useState<QmOption[]>([]);
  const [ncrLinkId, setNcrLinkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualityDefect(defectId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load defect");
    } finally {
      setLoading(false);
    }
  }, [defectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([listQualityNcrs(), loadQmOptions()]).then(([ncrs, opts]) => {
      const fromList = ncrs.map((n) => ({
        id: n.id,
        label: `${n.document_number} · ${n.status}`,
      }));
      setNcrOptions(fromList.length ? fromList : opts.ncrs);
    });
  }, []);

  async function onLinkNcr() {
    if (!row || !ncrLinkId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await linkDefectToNcr(row.id, ncrLinkId.trim());
      await load();
      setSuccess("Defect linked to NCR.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to link NCR");
    } finally {
      setBusy(false);
    }
  }

  const inspectionHref = row?.incoming_inspection_id
    ? `/quality/incoming-inspections/${row.incoming_inspection_id}`
    : row?.inprocess_inspection_id
      ? `/quality/inprocess-inspections/${row.inprocess_inspection_id}`
      : row?.final_inspection_id
        ? `/quality/final-inspections/${row.final_inspection_id}`
        : null;

  const createNcrHref = useMemo(() => {
    if (!row) return "/quality/ncrs/new";
    const params = new URLSearchParams({
      source: "inspection",
      description: row.description ?? `NCR from defect ${row.document_number ?? row.id}`,
      severity: row.severity,
    });
    if (row.product_id) params.set("product_id", row.product_id);
    if (row.incoming_inspection_id) params.set("incoming_inspection_id", row.incoming_inspection_id);
    if (row.inprocess_inspection_id) params.set("inprocess_inspection_id", row.inprocess_inspection_id);
    if (row.final_inspection_id) params.set("final_inspection_id", row.final_inspection_id);
    return `/quality/ncrs/new?${params.toString()}`;
  }, [row]);

  return (
    <ModuleDetailPage
      title={row?.document_number ?? "Defect"}
      subtitle="Quality defect record — link to NCR for formal non-conformance tracking"
      backHref="/quality/defects"
      backLabel="Back to defects"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        !row?.ncr_id ? (
          <Link
            href={createNcrHref}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
          >
            Create NCR
          </Link>
        ) : null
      }
    >
      {row ? (
        <div className="space-y-6">
          {success ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
          <ModuleDetailSection title="Defect Details">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(row.document_number) },
                { label: "Severity", value: <FinanceStatusBadge status={row.severity} /> },
                { label: "Quantity", value: String(row.quantity) },
                { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
                { label: "Source", value: textOrDash(row.source_inspection_type) },
                { label: "Description", value: textOrDash(row.description), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Links">
            <ModuleDetailGrid
              items={[
                {
                  label: "Source Inspection",
                  value: inspectionHref ? (
                    <ModuleCrossLink href={inspectionHref} label="View inspection" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "NCR",
                  value: row.ncr_id ? (
                    <ModuleCrossLink href={`/quality/ncrs/${row.ncr_id}`} label="View NCR" />
                  ) : (
                    "Not linked"
                  ),
                },
              ]}
            />
            {!row.ncr_id ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Select an existing NCR from the list (Quality → NCRs), or create a new one.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[240px] flex-1 space-y-1">
                    <span className="text-xs text-muted-foreground">Link to NCR</span>
                    <select
                      value={ncrLinkId}
                      onChange={(e) => setNcrLinkId(e.target.value)}
                      className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select NCR…</option>
                      {ncrOptions.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="button" size="sm" disabled={busy || !ncrLinkId} onClick={() => void onLinkNcr()}>
                    Link NCR
                  </Button>
                  <Link
                    href="/quality/ncrs"
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
                  >
                    Browse NCRs
                  </Link>
                </div>
              </div>
            ) : null}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}

function complaintActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "investigate", label: "Start investigation" }];
  if (s === "investigating" || s === "ncr_raised" || s === "capa_linked")
    return [{ key: "close", label: "Close complaint" }];
  return [];
}

export function ComplaintDetailPage({ complaintId }: { complaintId: string }) {
  const [row, setRow] = useState<QualityComplaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualityComplaint(complaintId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load complaint");
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (row ? complaintActions(row.status) : []), [row]);

  async function onWorkflow(action: string) {
    if (!row) return;
    setBusy(true);
    try {
      await qualityComplaintAction(row.id, action as "investigate" | "close");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={row?.document_number ?? "Complaint"}
      subtitle="Customer quality complaint"
      backHref="/quality/complaints"
      backLabel="Back to complaints"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
          {row && !row.ncr_id ? (
            <Link
              href={`/quality/ncrs/new?source=complaint&description=${encodeURIComponent(row.description ?? "")}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
            >
              Raise NCR
            </Link>
          ) : null}
          {row?.ncr_id ? (
            <Link
              href={`/quality/capas/new?ncr_id=${row.ncr_id}`}
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
            >
              Create CAPA
            </Link>
          ) : null}
        </div>
      }
    >
      {row ? (
        <ModuleDetailSection title="Complaint Details">
          <ModuleDetailGrid
            items={[
              { label: "Date", value: textOrDash(row.document_date) },
              { label: "Type", value: textOrDash(row.complaint_type) },
              { label: "Quantity", value: String(row.quantity) },
              { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
              { label: "Description", value: textOrDash(row.description), fullWidth: true },
              {
                label: "Linked NCR",
                value: row.ncr_id ? (
                  <ModuleCrossLink href={`/quality/ncrs/${row.ncr_id}`} label="View NCR" />
                ) : (
                  "—"
                ),
              },
            ]}
          />
        </ModuleDetailSection>
      ) : null}
    </ModuleDetailPage>
  );
}

function auditActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "planned" || s === "draft") return [{ key: "start", label: "Start audit" }];
  if (s === "in_progress") return [{ key: "complete", label: "Complete audit" }];
  if (s === "completed") return [{ key: "close", label: "Close audit" }];
  return [];
}

export function AuditDetailPage({ auditId }: { auditId: string }) {
  const [row, setRow] = useState<QualityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualityAudit(auditId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load audit");
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (row ? auditActions(row.status) : []), [row]);

  async function onWorkflow(action: string) {
    if (!row) return;
    setBusy(true);
    try {
      await qualityAuditAction(row.id, action as "start" | "complete" | "close");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={row?.document_number ?? "Audit"}
      subtitle="Quality audit"
      backHref="/quality/audits"
      backLabel="Back to audits"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {row ? (
        <ModuleDetailSection title="Audit Schedule">
          <ModuleDetailGrid
            items={[
              { label: "Type", value: textOrDash(row.audit_type) },
              { label: "Planned Start", value: textOrDash(row.planned_start) },
              { label: "Planned End", value: textOrDash(row.planned_end) },
              { label: "Actual Start", value: textOrDash(row.actual_start) },
              { label: "Actual End", value: textOrDash(row.actual_end) },
            ]}
          />
        </ModuleDetailSection>
      ) : null}
    </ModuleDetailPage>
  );
}

export function SupplierQualityDetailPage({ scoreId }: { scoreId: string }) {
  const [row, setRow] = useState<QualitySupplierScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualitySupplierScore(scoreId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load scorecard");
    } finally {
      setLoading(false);
    }
  }, [scoreId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPublish() {
    if (!row) return;
    setBusy(true);
    try {
      await qualitySupplierScoreAction(row.id, "publish");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title="Supplier Quality Score"
      subtitle={row ? `${row.score_period_start} → ${row.score_period_end}` : ""}
      backHref="/quality/supplier-quality"
      backLabel="Back to supplier quality"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        row?.status === "draft" ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void onPublish()}>
            Publish scorecard
          </Button>
        ) : null
      }
    >
      {row ? (
        <ModuleDetailSection title="Scorecard Metrics">
          <ModuleDetailGrid
            items={[
              { label: "Incoming Accept Rate", value: textOrDash(row.incoming_accept_rate) },
              { label: "Defect Rate", value: textOrDash(row.defect_rate) },
              { label: "NCR Count", value: textOrDash(row.ncr_count) },
              { label: "Overall Score", value: textOrDash(row.overall_score) },
            ]}
          />
        </ModuleDetailSection>
      ) : null}
    </ModuleDetailPage>
  );
}
