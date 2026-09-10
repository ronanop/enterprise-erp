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
  getQualityRecall,
  qualityRecallAction,
  updateQualityRecall,
  type QualityRecall,
} from "@/services/quality-service";

function recallActions(status: string): { key: string; label: string }[] {
  const s = status.toLowerCase();
  if (s === "draft") return [{ key: "announce", label: "Announce recall" }];
  if (s === "announced") {
    return [
      { key: "start", label: "Mark in progress" },
      { key: "close", label: "Close recall" },
    ];
  }
  if (s === "in_progress") return [{ key: "close", label: "Close recall" }];
  return [];
}

export function RecallDetailPage({ recallId }: { recallId: string }) {
  const [row, setRow] = useState<QualityRecall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getQualityRecall(recallId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load recall");
    } finally {
      setLoading(false);
    }
  }, [recallId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(() => (row ? recallActions(row.status) : []), [row]);

  async function onWorkflow(action: string) {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "start") {
        await updateQualityRecall(row.id, { status: "in_progress" });
      } else {
        await qualityRecallAction(row.id, action as "announce" | "close");
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
      title={row?.document_number ?? "Recall"}
      subtitle="Recall campaign and VIN range — CAPA stays the action plan"
      backHref="/quality/recalls"
      backLabel="Back to recalls"
      status={row?.status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions actions={actions} busy={busy} onAction={(a) => void onWorkflow(a)} />
          {row && !row.capa_id ? (
            <Link
              href={`/quality/capas/new?ncr_id=${row.ncr_id ?? ""}`}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm transition-colors duration-200 hover:bg-muted"
            >
              Create CAPA
            </Link>
          ) : null}
        </div>
      }
    >
      {row ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Recall Details">
            <ModuleDetailGrid
              items={[
                { label: "Date", value: textOrDash(row.document_date) },
                { label: "VIN from", value: textOrDash(row.vin_from) },
                { label: "VIN to", value: textOrDash(row.vin_to) },
                { label: "Status", value: <FinanceStatusBadge status={row.status} /> },
                { label: "Trigger reason", value: textOrDash(row.trigger_reason), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>
          <ModuleDetailSection title="Links">
            <ModuleDetailGrid
              items={[
                {
                  label: "Linked CAPA",
                  value: row.capa_id ? (
                    <ModuleCrossLink href={`/quality/capas/${row.capa_id}`} label="View CAPA" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Origin NCR",
                  value: row.ncr_id ? (
                    <ModuleCrossLink href={`/quality/ncrs/${row.ncr_id}`} label="View NCR" />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Origin warranty claim",
                  value: row.warranty_claim_id ? (
                    <ModuleCrossLink
                      href={`/quality/warranty-claims/${row.warranty_claim_id}`}
                      label="View warranty claim"
                    />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
