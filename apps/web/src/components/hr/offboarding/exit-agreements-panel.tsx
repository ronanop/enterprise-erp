"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, ShieldCheck } from "lucide-react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupField } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  declineExitAgreement,
  isApiError,
  issueExitAgreement,
  listExitAgreements,
  signExitAgreement,
  type ExitAgreement,
  type ExitAgreementType,
} from "@/services/offboarding-service";

const AGREEMENT_META: Record<
  ExitAgreementType,
  { label: string; blurb: string; required: boolean }
> = {
  noc: {
    label: "No Objection Certificate",
    blurb: "Confirms assets returned, access revoked and no dues outstanding.",
    required: true,
  },
  nda: {
    label: "Confidentiality Undertaking",
    blurb: "Customer lists, pricing and technical information stay confidential after exit.",
    required: true,
  },
  non_solicit: {
    label: "Non-Solicitation Undertaking",
    blurb: "Bars approaching company customers or staff for an agreed period.",
    required: false,
  },
};

const ORDER: ExitAgreementType[] = ["noc", "nda", "non_solicit"];

// Exits far enough along that the paperwork can be issued.
const ISSUABLE_STATUSES = new Set([
  "manager_approved",
  "it_approved",
  "accounts_approved",
  "hr_approved",
]);

export function ExitAgreementsPanel({
  caseId,
  caseStatus,
  employeeName,
}: {
  caseId: string;
  caseStatus: string;
  employeeName: string;
}) {
  const [agreements, setAgreements] = useState<ExitAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [months, setMonths] = useState("6");
  const [signatures, setSignatures] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgreements(await listExitAgreements(caseId));
    } catch (err) {
      toast(isApiError(err), "error");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canIssue = ISSUABLE_STATUSES.has(caseStatus.toLowerCase());
  const byType = new Map(agreements.map((a) => [a.agreement_type, a]));

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast(message);
      await load();
    } catch (err) {
      toast(isApiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Exit Agreements</h3>
          <p className="text-xs text-muted-foreground">
            The NOC and confidentiality undertaking must be signed before the exit can be
            completed.
          </p>
        </div>
        <SetupField label="Non-solicit months">
          <Input
            value={months}
            inputMode="numeric"
            onChange={(e) => setMonths(e.target.value)}
            className="h-8 w-20 font-mono"
          />
        </SetupField>
      </div>

      {!canIssue ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Agreements can be issued once the reporting manager has approved the exit.
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading agreements…</p>
      ) : (
        <ul className="space-y-3">
          {ORDER.map((type) => {
            const meta = AGREEMENT_META[type];
            const agreement = byType.get(type);
            const signed = agreement?.status === "signed";

            return (
              <li
                key={type}
                className={cn(
                  "rounded-lg border px-3 py-3 transition-colors duration-200",
                  signed ? "border-emerald-200 bg-emerald-50/60" : "border-border/60",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {signed ? (
                        <ShieldCheck className="size-3.5 text-emerald-700" aria-hidden />
                      ) : (
                        <FileSignature className="size-3.5 text-muted-foreground" aria-hidden />
                      )}
                      {meta.label}
                      {meta.required ? (
                        <span className="text-[10px] text-destructive">Required</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.blurb}</p>
                  </div>
                  {agreement ? <HrStatusBadge status={agreement.status} /> : null}
                </div>

                {!agreement ? (
                  <Button
                    size="sm"
                    className="mt-2 cursor-pointer transition-colors duration-200"
                    disabled={busy || !canIssue}
                    onClick={() =>
                      void run(
                        () =>
                          issueExitAgreement(
                            caseId,
                            type,
                            type === "non_solicit" ? Number(months) || 6 : undefined,
                          ),
                        `${meta.label} issued`,
                      )
                    }
                  >
                    Issue for signature
                  </Button>
                ) : (
                  <>
                    <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 px-3 py-2 font-sans text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {agreement.body_text}
                    </pre>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {agreement.document_number} · SHA-256 {agreement.body_sha256.slice(0, 16)}…
                    </p>

                    {signed ? (
                      <p className="mt-2 text-xs text-emerald-800">
                        Signed by {agreement.signature_name} on{" "}
                        {agreement.signed_at?.slice(0, 10)}
                        {agreement.signature_ip ? ` from ${agreement.signature_ip}` : ""}
                        {agreement.restriction_end_date
                          ? `. Restriction runs until ${agreement.restriction_end_date}.`
                          : ""}
                      </p>
                    ) : agreement.status === "issued" ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <SetupField label="Type full name to sign">
                          <Input
                            value={signatures[agreement.id] ?? ""}
                            placeholder={employeeName}
                            onChange={(e) =>
                              setSignatures((prev) => ({
                                ...prev,
                                [agreement.id]: e.target.value,
                              }))
                            }
                            className="h-8 w-56"
                          />
                        </SetupField>
                        <Button
                          size="sm"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={busy || !(signatures[agreement.id] ?? "").trim()}
                          onClick={() =>
                            void run(
                              () =>
                                signExitAgreement(
                                  agreement.id,
                                  signatures[agreement.id] ?? "",
                                ),
                              `${meta.label} signed`,
                            )
                          }
                        >
                          Sign
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer transition-colors duration-200"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                declineExitAgreement(
                                  agreement.id,
                                  "Declined by employee",
                                ),
                              `${meta.label} declined`,
                            )
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {agreement.decline_reason}
                      </p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
