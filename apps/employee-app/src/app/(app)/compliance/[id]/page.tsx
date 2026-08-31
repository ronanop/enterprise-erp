"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { AlertBox } from "@/components/ui";
import { useEssMe } from "@/context/ess-me-context";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import type { EssPolicyWalkthrough } from "@/types/api";
import * as ui from "@/theme/classes";

export default function PolicyWalkthroughPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useEssMe();
  const [data, setData] = useState<EssPolicyWalkthrough | null>(null);
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    essService
      .policyWalkthrough(params.id)
      .then((res) => {
        if (!cancelled) setData(res.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load policy");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const steps = data?.steps ?? [];
  const current = steps[step];
  const onLast = step >= steps.length - 1;

  async function finish() {
    if (!agree) return;
    setSubmitting(true);
    setError(null);
    try {
      await essService.acknowledgePolicy(params.id);
      await refresh();
      router.replace("/compliance");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save acknowledgment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <SubHeader title={data?.title ?? "Policy"} backHref="/compliance" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : !data || !current ? (
        <p className="text-sm text-[#434655]">Policy not found.</p>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase text-[#434655]">
            Step {step + 1} of {steps.length}
          </p>
          <div className={`${ui.card} space-y-3 p-4`}>
            <h2 className="text-lg font-bold text-[#0b1c30]">{current.title}</h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#434655]">
              {current.body}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={`${ui.btnSecondary} flex-1`}
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            {!onLast ? (
              <button
                type="button"
                className={`${ui.btn} flex-1`}
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className={`${ui.btn} flex-1`}
                disabled={!agree || submitting}
                onClick={() => void finish()}
              >
                {submitting ? "Saving…" : "Finish"}
              </button>
            )}
          </div>

          {onLast ? (
            <label className="flex items-start gap-2 text-sm text-[#434655]">
              <input
                type="checkbox"
                className="mt-1"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I have read and understood <strong>{data.title}</strong> (version{" "}
                {data.policy_version}).
              </span>
            </label>
          ) : null}
        </>
      )}
    </div>
  );
}
