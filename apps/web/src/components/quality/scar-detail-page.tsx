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
import { QmTextAreaField } from "@/components/quality/quality-form-fields";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import { getQualityScar, qualityScarAction, type QualityScar } from "@/services/quality-service";

function workflowActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "issue", label: "Issue to supplier" }];
  if (s === "responded") return [{ key: "verify", label: "Verify response" }];
  if (s === "verified") return [{ key: "close", label: "Close SCAR" }];
  return [];
}

export function ScarDetailPage({ scarId }: { scarId: string }) {
  const [scar, setScar] = useState<QualityScar | null>(null);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getQualityScar(scarId);
      setScar(row);
      setResponseText(row.supplier_response ?? "");
    } catch (err) {
      setScar(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load SCAR");
    } finally {
      setLoading(false);
    }
  }, [scarId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (scar ? workflowActions(scar.status) : []), [scar]);

  async function onWorkflow(action: string) {
    if (!scar) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "record-response") {
        await qualityScarAction(scar.id, "record-response", { supplier_response: responseText });
      } else {
        await qualityScarAction(scar.id, action as "issue" | "verify" | "close");
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Workflow action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleDetailPage
      title={scar?.document_number ?? "SCAR"}
      subtitle="Supplier Corrective Action Request — independent of internal NCR lifecycle"
      backHref="/quality/scars"
      backLabel="Back to SCARs"
      status={scar?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
      }
    >
      {scar ? (
        <div className="space-y-6">
          <ModuleDetailSection title="SCAR Details">
            <ModuleDetailGrid
              items={[
                { label: "Document", value: textOrDash(scar.document_number) },
                { label: "Date", value: textOrDash(scar.document_date) },
                { label: "Due date", value: textOrDash(scar.due_date) },
                { label: "Severity", value: <FinanceStatusBadge status={scar.severity} /> },
                { label: "Status", value: <FinanceStatusBadge status={scar.status} /> },
                {
                  label: "Description",
                  value: textOrDash(scar.description),
                  fullWidth: true,
                },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Links">
            <ModuleDetailGrid
              items={[
                {
                  label: "Related NCR",
                  value: scar.ncr_id ? (
                    <ModuleCrossLink href={`/quality/ncrs/${scar.ncr_id}`} label="View internal NCR" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Related CAPA",
                  value: scar.capa_id ? (
                    <ModuleCrossLink href={`/quality/capas/${scar.capa_id}`} label="View CAPA" />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </ModuleDetailSection>

          <ModuleDetailSection title="Supplier response">
            {scar.status === "issued" ? (
              <div className="space-y-3">
                <QmTextAreaField
                  label="Supplier response"
                  value={responseText}
                  onChange={setResponseText}
                />
                <button
                  type="button"
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground transition-colors duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  disabled={busy || !responseText.trim()}
                  onClick={() => void onWorkflow("record-response")}
                >
                  Record response
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">{textOrDash(scar.supplier_response)}</p>
            )}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
