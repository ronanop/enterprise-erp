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
import { ApiClientError } from "@/services/api-client";
import {
  getQualityNcr,
  listQualityCapasByNcr,
  listQualityDefectsByNcr,
  qualityNcrAction,
  type QualityCapa,
  type QualityNcr,
  type QualityRow,
} from "@/services/quality-service";

function workflowActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "submit", label: "Submit NCR" }];
  if (s === "submitted") return [{ key: "approve", label: "Approve" }];
  if (s === "approved") return [{ key: "close", label: "Close NCR" }];
  return [];
}

export function NcrDetailPage({ ncrId }: { ncrId: string }) {
  const [ncr, setNcr] = useState<QualityNcr | null>(null);
  const [capas, setCapas] = useState<QualityCapa[]>([]);
  const [defects, setDefects] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ncrRow, capaRows, defectRows] = await Promise.all([
        getQualityNcr(ncrId),
        listQualityCapasByNcr(ncrId),
        listQualityDefectsByNcr(ncrId),
      ]);
      setNcr(ncrRow);
      setCapas(capaRows);
      setDefects(defectRows);
    } catch (err) {
      setNcr(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load NCR");
    } finally {
      setLoading(false);
    }
  }, [ncrId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (ncr ? workflowActions(ncr.status) : []), [ncr]);

  async function onWorkflow(action: string) {
    if (!ncr) return;
    setBusy(true);
    try {
      await qualityNcrAction(ncr.id, action as "submit" | "approve" | "close");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={ncr?.document_number ?? "NCR"}
      subtitle="Non-conformance report — FRD-14 §9"
      backHref="/quality/ncrs"
      backLabel="Back to NCRs"
      status={ncr?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
          {ncr && ncr.status !== "closed" && ncr.status !== "cancelled" ? (
            <Link
              href={`/quality/capas/new?ncr_id=${ncr.id}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
            >
              Create CAPA
            </Link>
          ) : null}
        </div>
      }
    >
      {ncr ? (
        <div className="space-y-6">
          <ModuleDetailSection title="NCR Details">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(ncr.document_number) },
                { label: "Date", value: textOrDash(ncr.document_date) },
                { label: "Source", value: textOrDash(ncr.source) },
                { label: "Severity", value: <FinanceStatusBadge status={ncr.severity} /> },
                { label: "Status", value: <FinanceStatusBadge status={ncr.status} /> },
                {
                  label: "Description",
                  value: textOrDash(ncr.description),
                  fullWidth: true,
                },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Upstream Links (Procurement / Manufacturing)">
            <ModuleDetailGrid
              items={[
                {
                  label: "Incoming Inspection",
                  value: ncr.incoming_inspection_id ? (
                    <ModuleCrossLink
                      href={`/quality/incoming-inspections/${ncr.incoming_inspection_id}`}
                      label="View IQC record"
                    />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "In-Process Inspection",
                  value: ncr.inprocess_inspection_id ? (
                    <ModuleCrossLink
                      href={`/quality/inprocess-inspections/${ncr.inprocess_inspection_id}`}
                      label="View IPQC record"
                    />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Final Inspection",
                  value: ncr.final_inspection_id ? (
                    <ModuleCrossLink
                      href={`/quality/final-inspections/${ncr.final_inspection_id}`}
                      label="View FQC record"
                    />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Linked Defects">
            {defects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No defects linked.</p>
            ) : (
              <ul className="space-y-2">
                {defects.map((d) => (
                  <li key={String(d.id)}>
                    <ModuleCrossLink
                      href={`/quality/defects/${String(d.id)}`}
                      label={`${String(d.document_number ?? d.id)} · ${String(d.severity ?? "")}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ModuleDetailSection>

          <ModuleDetailSection title="CAPA Records (Downstream)">
            {capas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CAPA linked yet.</p>
            ) : (
              <ul className="space-y-2">
                {capas.map((capa) => (
                  <li key={capa.id}>
                    <ModuleCrossLink
                      href={`/quality/capas/${capa.id}`}
                      label={`${capa.document_number} · ${capa.status}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
