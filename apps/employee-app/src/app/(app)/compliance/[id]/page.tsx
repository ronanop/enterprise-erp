"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubHeader } from "@/components/app-header";
import { PolicyMarkdown } from "@/components/policy-markdown";
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
    setStep(0);
    setAgree(false);
    essService
      .policyWalkthrough(params.id)
      .then((res) => {
        if (!cancelled) setData(res.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load policy",
          );
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
  const onLast = steps.length > 0 && step >= steps.length - 1;
  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    return Math.round(((step + 1) / steps.length) * 100);
  }, [step, steps.length]);

  const alreadyAcked = Boolean(data?.acknowledged);

  async function finish() {
    if (alreadyAcked) {
      router.replace("/compliance");
      return;
    }
    if (!agree) return;
    setSubmitting(true);
    setError(null);
    try {
      await essService.acknowledgePolicy(params.id);
      await refresh();
      router.replace("/compliance");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not save acknowledgment",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-4 pb-4">
      <SubHeader title={data?.title ?? "Policy"} backHref="/compliance" />

      {error ? <AlertBox tone="danger">{error}</AlertBox> : null}

      {loading ? (
        <p className="text-sm text-[#434655]">Loading…</p>
      ) : !data || !current ? (
        <p className="text-sm text-[#434655]">Policy not found.</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-[#434655]">
              <span>
                Step {step + 1} of {steps.length}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#dce9ff]">
              <div
                className="h-full rounded-full bg-[#2563eb] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={`${s.order}-${idx}`}
                  type="button"
                  aria-label={`Go to step ${idx + 1}`}
                  onClick={() => {
                    setStep(idx);
                    if (idx < steps.length - 1) setAgree(false);
                  }}
                  className={`h-1.5 flex-1 min-w-[1.5rem] rounded-full transition ${
                    idx <= step ? "bg-[#2563eb]" : "bg-[#c3c6d7]/50"
                  }`}
                />
              ))}
            </div>
          </div>

          <section className={`${ui.card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="border-b border-[#c3c6d7]/25 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#737686]">
                {data.policy_code} · v{data.policy_version}
              </p>
              <h2 className="mt-1 text-lg font-bold leading-snug text-[#0b1c30]">
                {current.title}
              </h2>
            </div>
            <div className="min-h-[12rem] flex-1 overflow-y-auto px-4 py-4">
              <PolicyMarkdown content={current.body} />
            </div>
          </section>

          {onLast && !alreadyAcked ? (
            <label className={`${ui.card} flex items-start gap-3 p-4 text-sm text-[#434655]`}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#2563eb]"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I have read and understood <strong className="text-[#0b1c30]">{data.title}</strong>{" "}
                (version {data.policy_version}).
              </span>
            </label>
          ) : null}

          {onLast && alreadyAcked ? (
            <div className={`${ui.card} px-4 py-3 text-sm font-medium text-emerald-800`}>
              Already acknowledged — version {data.policy_version}.
            </div>
          ) : null}

          <div className="sticky bottom-2 z-20 flex gap-2 rounded-2xl bg-[#F5F8FC]/92 p-1 backdrop-blur">
            <button
              type="button"
              className={`${ui.btnSecondary} flex-1`}
              disabled={step === 0}
              onClick={() => {
                setStep((s) => Math.max(0, s - 1));
                setAgree(false);
              }}
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
                disabled={(!alreadyAcked && !agree) || submitting}
                onClick={() => void finish()}
              >
                {alreadyAcked
                  ? "Done"
                  : submitting
                    ? "Saving…"
                    : "Acknowledge"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
