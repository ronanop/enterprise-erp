"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

import {
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCaseByToken,
  savePortalProgress,
  submitPortal,
} from "@/services/onboarding-management-service";
import type {
  OnboardingCase,
  OnboardingDocument,
  PortalPayload,
  PortalStepId,
} from "@/types/onboarding-management";
import { POLICY_DOCS, PORTAL_STEPS } from "@/types/onboarding-management";

export function CandidateOnboardingPortal({ token }: { token: string }) {
  const [caseRow, setCaseRow] = useState<OnboardingCase | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const c = getCaseByToken(token);
    if (!c) {
      setError("This onboarding link is invalid or has been removed.");
      return;
    }
    if (c.invitation && new Date(c.invitation.expiresAt).getTime() < Date.now()) {
      setError("This onboarding link has expired. Please contact HR for a new invitation.");
      setCaseRow(c);
      return;
    }
    if (c.portal.submittedAt || c.status === "joined") {
      setDone(true);
    }
    setCaseRow(c);
    setPortal(c.portal);
  }, [token]);

  const stepIdx = useMemo(() => {
    if (!portal) return 0;
    return Math.max(
      0,
      PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep),
    );
  }, [portal]);

  function patchPortal(partial: Partial<PortalPayload>) {
    setPortal((p) => (p ? { ...p, ...partial } : p));
  }

  function go(step: PortalStepId) {
    if (!portal) return;
    const next = { ...portal, currentStep: step };
    setPortal(next);
    savePortalProgress(token, next);
  }

  function nextStep() {
    if (!portal) return;
    const i = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
    if (i < PORTAL_STEPS.length - 1) go(PORTAL_STEPS[i + 1].id);
  }

  function prevStep() {
    if (!portal) return;
    const i = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
    if (i > 0) go(PORTAL_STEPS[i - 1].id);
  }

  function addDocument(kind: OnboardingDocument["kind"], fileName: string) {
    if (!portal || !fileName) return;
    const doc: OnboardingDocument = {
      id: crypto.randomUUID(),
      kind,
      fileName,
      uploadedAt: new Date().toISOString(),
      verifyStatus: "pending",
    };
    patchPortal({ documents: [...portal.documents, doc] });
  }

  async function handleSave() {
    if (!portal) return;
    setSaving(true);
    try {
      savePortalProgress(token, portal);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!portal) return;
    if (!portal.policies.agreed || !portal.policies.signature.trim()) {
      setError("Please accept policies and provide a digital signature before submitting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const submitted = submitPortal(token, portal);
      if (submitted) {
        setDone(true);
        setCaseRow(submitted);
        setPortal(submitted.portal);
      }
    } finally {
      setSaving(false);
    }
  }

  if (error && !caseRow) {
    return (
      <Shell>
        <div className="rounded-xl border border-destructive/30 bg-red-50 px-4 py-6 text-sm text-red-900">
          {error}
        </div>
      </Shell>
    );
  }

  if (!caseRow || !portal) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading your onboarding portal…</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h1 className="mt-3 text-lg font-semibold text-emerald-950">Onboarding submitted</h1>
          <p className="mt-1 text-sm text-emerald-900/80">
            Thank you, {caseRow.candidateName}. HR will verify your information before{" "}
            {caseRow.joiningDate || "your joining date"}.
          </p>
          {caseRow.employeeId ? (
            <p className="mt-3 font-mono text-sm text-emerald-950">Employee ID: {caseRow.employeeId}</p>
          ) : null}
        </div>
      </Shell>
    );
  }

  const step = PORTAL_STEPS[stepIdx];

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Secure onboarding · {caseRow.caseCode}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          Welcome, {caseRow.candidateName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your profile before joining on {caseRow.joiningDate || "—"}. Link expires{" "}
          {caseRow.invitation
            ? new Date(caseRow.invitation.expiresAt).toLocaleDateString()
            : "soon"}
          .
        </p>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Step {stepIdx + 1} of {PORTAL_STEPS.length}
          </span>
          <span>{Math.round(((stepIdx + 1) / PORTAL_STEPS.length) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / PORTAL_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {PORTAL_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition-colors duration-200",
                i === stepIdx
                  ? "bg-primary text-primary-foreground"
                  : i < stepIdx
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-muted text-muted-foreground",
              )}
              onClick={() => go(s.id)}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{step.label}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{step.description}</p>

        {step.id === "personal" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SetupField label="First name" required>
              <SetupInput
                value={portal.personal.firstName}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, firstName: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Middle name">
              <SetupInput
                value={portal.personal.middleName}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, middleName: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Last name" required>
              <SetupInput
                value={portal.personal.lastName}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, lastName: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Gender">
              <SetupSelect
                value={portal.personal.gender}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, gender: e.target.value } })
                }
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </SetupSelect>
            </SetupField>
            <SetupField label="Date of birth">
              <SetupInput
                type="date"
                value={portal.personal.dob}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, dob: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Marital status">
              <SetupInput
                value={portal.personal.maritalStatus}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, maritalStatus: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Nationality">
              <SetupInput
                value={portal.personal.nationality}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, nationality: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Blood group">
              <SetupInput
                value={portal.personal.bloodGroup}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, bloodGroup: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Phone">
              <SetupInput
                value={portal.personal.phone}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, phone: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Email">
              <SetupInput
                type="email"
                value={portal.personal.email}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, email: e.target.value } })
                }
              />
            </SetupField>
            <div className="sm:col-span-2">
              <SetupField label="Address">
                <SetupTextarea
                  value={portal.personal.address}
                  onChange={(e) =>
                    patchPortal({ personal: { ...portal.personal, address: e.target.value } })
                  }
                  rows={2}
                />
              </SetupField>
            </div>
            <SetupField label="Photo file name" hint="Demo upload — store file name">
              <SetupInput
                placeholder="photo.jpg"
                value={portal.personal.photoName ?? ""}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, photoName: e.target.value } })
                }
              />
            </SetupField>
          </div>
        ) : null}

        {step.id === "government_ids" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["aadhaar", "Aadhaar"],
                ["pan", "PAN"],
                ["passport", "Passport"],
                ["drivingLicense", "Driving License"],
                ["uan", "UAN"],
                ["esic", "ESIC"],
              ] as const
            ).map(([key, label]) => (
              <SetupField key={key} label={label}>
                <SetupInput
                  value={portal.governmentIds[key]}
                  onChange={(e) =>
                    patchPortal({
                      governmentIds: { ...portal.governmentIds, [key]: e.target.value },
                    })
                  }
                />
              </SetupField>
            ))}
          </div>
        ) : null}

        {step.id === "bank" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["bankName", "Bank name"],
                ["accountHolder", "Account holder"],
                ["accountNumber", "Account number"],
                ["ifsc", "IFSC"],
                ["branch", "Branch"],
                ["upi", "UPI"],
              ] as const
            ).map(([key, label]) => (
              <SetupField key={key} label={label}>
                <SetupInput
                  value={portal.bank[key]}
                  onChange={(e) =>
                    patchPortal({ bank: { ...portal.bank, [key]: e.target.value } })
                  }
                />
              </SetupField>
            ))}
          </div>
        ) : null}

        {step.id === "emergency" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SetupField label="Name" required>
              <SetupInput
                value={portal.emergency.name}
                onChange={(e) =>
                  patchPortal({ emergency: { ...portal.emergency, name: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Relationship">
              <SetupInput
                value={portal.emergency.relationship}
                onChange={(e) =>
                  patchPortal({
                    emergency: { ...portal.emergency, relationship: e.target.value },
                  })
                }
              />
            </SetupField>
            <SetupField label="Phone">
              <SetupInput
                value={portal.emergency.phone}
                onChange={(e) =>
                  patchPortal({ emergency: { ...portal.emergency, phone: e.target.value } })
                }
              />
            </SetupField>
            <div className="sm:col-span-2">
              <SetupField label="Address">
                <SetupTextarea
                  value={portal.emergency.address}
                  onChange={(e) =>
                    patchPortal({ emergency: { ...portal.emergency, address: e.target.value } })
                  }
                  rows={2}
                />
              </SetupField>
            </div>
          </div>
        ) : null}

        {step.id === "documents" ? (
          <div className="space-y-3">
            {(
              [
                ["photo", "Photo"],
                ["resume", "Resume"],
                ["pan", "PAN"],
                ["aadhaar", "Aadhaar"],
                ["passport", "Passport"],
                ["education", "Education Certificates"],
                ["experience", "Experience Certificates"],
                ["cancelled_cheque", "Cancelled Cheque"],
                ["offer_letter", "Offer Letter"],
              ] as const
            ).map(([kind, label]) => (
              <SetupField key={kind} label={label}>
                <SetupInput
                  placeholder={`${label} file name`}
                  onChange={(e) => {
                    if (e.target.value.trim()) addDocument(kind, e.target.value.trim());
                    e.target.value = "";
                  }}
                />
              </SetupField>
            ))}
            <ul className="space-y-1 text-xs">
              {portal.documents.map((d) => (
                <li key={d.id} className="rounded-md border border-border/60 px-2 py-1.5">
                  {d.fileName} · <span className="uppercase text-muted-foreground">{d.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step.id === "policies" ? (
          <div className="space-y-3">
            <ul className="space-y-2 text-xs">
              {POLICY_DOCS.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                >
                  <span>{p.label}</span>
                  <span className="text-muted-foreground">View PDF</span>
                </li>
              ))}
            </ul>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 cursor-pointer"
                checked={portal.policies.agreed}
                onChange={(e) =>
                  patchPortal({
                    policies: {
                      ...portal.policies,
                      agreed: e.target.checked,
                      policies: POLICY_DOCS.map((p) => p.id),
                      acceptedAt: e.target.checked ? new Date().toISOString() : undefined,
                    },
                  })
                }
              />
              <span>I agree to the Employee Handbook, NDA, IT Policy, Code of Conduct, and Privacy Policy.</span>
            </label>
            <SetupField label="Digital signature" required hint="Type your full name as signature">
              <SetupInput
                value={portal.policies.signature}
                onChange={(e) =>
                  patchPortal({
                    policies: { ...portal.policies, signature: e.target.value },
                  })
                }
              />
            </SetupField>
          </div>
        ) : null}

        {step.id === "review" ? (
          <div className="space-y-3 text-xs">
            <ReviewRow label="Name" value={`${portal.personal.firstName} ${portal.personal.lastName}`} />
            <ReviewRow label="Email" value={portal.personal.email} />
            <ReviewRow label="PAN" value={portal.governmentIds.pan || "—"} />
            <ReviewRow label="Bank" value={portal.bank.bankName || "—"} />
            <ReviewRow label="Emergency" value={portal.emergency.name || "—"} />
            <ReviewRow label="Documents" value={String(portal.documents.length)} />
            <ReviewRow
              label="Policies"
              value={portal.policies.agreed ? `Signed: ${portal.policies.signature}` : "Not accepted"}
            />
            <p className="text-muted-foreground">
              After submit, HR will verify documents and activate your employee profile.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={stepIdx === 0}
            onClick={prevStep}
          >
            <ChevronLeft className="size-3.5" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            {step.id !== "review" ? (
              <Button type="button" size="sm" className="cursor-pointer" onClick={nextStep}>
                Continue
                <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={saving}
                onClick={() => void handleSubmit()}
              >
                Submit onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
