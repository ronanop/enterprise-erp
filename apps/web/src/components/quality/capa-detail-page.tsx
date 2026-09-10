"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import { getQualityCapa, qualityCapaAction, type QualityCapa } from "@/services/quality-service";

function workflowActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "submit", label: "Submit CAPA" }];
  if (s === "submitted") return [{ key: "approve", label: "Approve" }];
  if (s === "approved" || s === "in_progress") return [{ key: "verify", label: "Verify" }];
  if (s === "verified") return [{ key: "close", label: "Close CAPA" }];
  return [];
}

function ActionList({ title, items }: { title: string; items: QualityCapa["corrective_actions"] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-sm">{item.action_text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              #{item.sequence_no} · <FinanceStatusBadge status={item.status} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CapaDetailPage({ capaId }: { capaId: string }) {
  const [capa, setCapa] = useState<QualityCapa | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCapa(await getQualityCapa(capaId));
    } catch (err) {
      setCapa(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load CAPA");
    } finally {
      setLoading(false);
    }
  }, [capaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (capa ? workflowActions(capa.status) : []), [capa]);

  async function onWorkflow(action: string) {
    if (!capa) return;
    setBusy(true);
    try {
      await qualityCapaAction(capa.id, action as "submit" | "approve" | "verify" | "close");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={capa?.document_number ?? "CAPA"}
      subtitle="Corrective & preventive action — FRD-14 §10"
      backHref="/quality/capas"
      backLabel="Back to CAPAs"
      status={capa?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {capa ? (
        <div className="space-y-6">
          <ModuleDetailSection title="CAPA Details">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(capa.document_number) },
                { label: "Type", value: textOrDash(capa.capa_type) },
                { label: "Due Date", value: textOrDash(capa.due_date) },
                { label: "Status", value: <FinanceStatusBadge status={capa.status} /> },
                {
                  label: "Linked NCR",
                  value: (
                    <ModuleCrossLink href={`/quality/ncrs/${capa.ncr_id}`} label="View source NCR" />
                  ),
                },
                { label: "Notes", value: textOrDash(capa.notes), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Root Cause Analysis">
            {capa.root_causes?.length ? (
              <ul className="space-y-2">
                {capa.root_causes.map((rc) => (
                  <li key={rc.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">{rc.method}</span>
                    <p className="mt-1">{rc.cause_text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No root causes recorded.</p>
            )}
          </ModuleDetailSection>

          <ModuleDetailSection title="Actions">
            <div className="space-y-6">
              <ActionList title="Corrective Actions" items={capa.corrective_actions} />
              <ActionList title="Preventive Actions" items={capa.preventive_actions} />
            </div>
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
