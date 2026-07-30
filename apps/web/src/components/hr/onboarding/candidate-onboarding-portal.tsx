"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Upload, X } from "lucide-react";

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
import {
  listPortalDocumentTypes,
  type PortalDocumentType,
} from "@/services/hr-setup-service";
import type {
  DocumentKind,
  OnboardingCase,
  OnboardingDocument,
  PortalPayload,
  PortalStepId,
} from "@/types/onboarding-management";
import { POLICY_DOCS, PORTAL_STEPS } from "@/types/onboarding-management";

const AADHAAR_LEN = 16;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ACCOUNT_MIN = 9;
const ACCOUNT_MAX = 18;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const DEMO_POLICY_BODY: Record<string, string> = {
  handbook:
    "Employee Handbook (demo)\n\nWelcome to the organization. This handbook outlines workplace expectations, leave entitlements, attendance rules, and HR contacts. Full PDF will be linked by HR in production.",
  nda: "Non-Disclosure Agreement (demo)\n\nYou agree not to disclose confidential company information, customer data, or trade secrets during and after employment. This is seed content for onboarding preview.",
  it_policy:
    "IT Policy (demo)\n\nUse company devices and accounts responsibly. Do not share passwords. Report security incidents promptly. Personal software installs require IT approval.",
  code_of_conduct:
    "Code of Conduct (demo)\n\nTreat colleagues with respect. Zero tolerance for harassment or discrimination. Follow conflict-of-interest and gift policies.",
  privacy:
    "Privacy Policy (demo)\n\nWe process personal data for employment, payroll, and compliance. Data is retained per statutory requirements and shared only with authorized processors.",
};

function asDocumentKind(kind: string): DocumentKind {
  const known: DocumentKind[] = [
    "photo",
    "resume",
    "pan",
    "aadhaar",
    "passport",
    "education",
    "experience",
    "cancelled_cheque",
    "bank_details",
    "appointment_letter",
    "relieving_letter",
    "salary_slips",
    "previous_employer",
    "signature",
    "other",
  ];
  return (known.includes(kind as DocumentKind) ? kind : "other") as DocumentKind;
}

export function CandidateOnboardingPortal({ token }: { token: string }) {
  const [caseRow, setCaseRow] = useState<OnboardingCase | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [policyPreview, setPolicyPreview] = useState<(typeof POLICY_DOCS)[number] | null>(null);
  const [docTypes, setDocTypes] = useState<PortalDocumentType[]>([]);

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

  useEffect(() => {
    void listPortalDocumentTypes().then(setDocTypes);
  }, []);

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
    setStepError(null);
    savePortalProgress(token, next);
  }

  function validateCurrentStep(): string | null {
    if (!portal) return "Portal not loaded.";
    switch (portal.currentStep) {
      case "government_ids": {
        const aadhaar = digitsOnly(portal.governmentIds.aadhaar);
        const pan = portal.governmentIds.pan.trim().toUpperCase();
        if (aadhaar.length !== AADHAAR_LEN) {
          return `Aadhaar must be exactly ${AADHAAR_LEN} digits.`;
        }
        if (!PAN_RE.test(pan)) {
          return "PAN must be 10 characters (e.g. ABCDE1234F).";
        }
        return null;
      }
      case "bank": {
        const account = digitsOnly(portal.bank.accountNumber);
        const ifsc = portal.bank.ifsc.trim().toUpperCase();
        if (!portal.bank.bankName.trim() || !portal.bank.accountHolder.trim()) {
          return "Bank name and account holder are required.";
        }
        if (account.length < ACCOUNT_MIN || account.length > ACCOUNT_MAX) {
          return `Account number must be ${ACCOUNT_MIN}–${ACCOUNT_MAX} digits.`;
        }
        if (!IFSC_RE.test(ifsc)) {
          return "IFSC must be 11 characters (e.g. HDFC0001234).";
        }
        return null;
      }
      case "documents": {
        const missing = docTypes
          .filter((t) => t.mandatory)
          .filter(
            (t) =>
              !portal.documents.some(
                (d) => d.typeCode === t.code || (!d.typeCode && d.kind === t.kind),
              ),
          );
        if (missing.length) {
          return `Please upload: ${missing.map((m) => m.name).join(", ")}.`;
        }
        return null;
      }
      case "policies": {
        if (!portal.policies.agreed) {
          return "Please agree to the policies before continuing.";
        }
        if (!portal.policies.signature.trim() && !portal.policies.signatureDataUrl) {
          return "Digital signature is required before continuing.";
        }
        return null;
      }
      default:
        return null;
    }
  }

  function nextStep() {
    if (!portal) return;
    const msg = validateCurrentStep();
    if (msg) {
      setStepError(msg);
      return;
    }
    setStepError(null);
    let nextPortal = portal;
    if (portal.currentStep === "government_ids") {
      nextPortal = {
        ...portal,
        governmentIds: {
          ...portal.governmentIds,
          aadhaar: digitsOnly(portal.governmentIds.aadhaar),
          pan: portal.governmentIds.pan.trim().toUpperCase(),
        },
      };
    } else if (portal.currentStep === "bank") {
      nextPortal = {
        ...portal,
        bank: {
          ...portal.bank,
          accountNumber: digitsOnly(portal.bank.accountNumber),
          ifsc: portal.bank.ifsc.trim().toUpperCase(),
        },
      };
    }
    const i = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
    if (i >= PORTAL_STEPS.length - 1) {
      setPortal(nextPortal);
      return;
    }
    const advanced = { ...nextPortal, currentStep: PORTAL_STEPS[i + 1].id };
    setPortal(advanced);
    savePortalProgress(token, advanced);
  }

  function prevStep() {
    if (!portal) return;
    setStepError(null);
    const i = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
    if (i > 0) go(PORTAL_STEPS[i - 1].id);
  }

  function upsertDocument(kind: DocumentKind, fileName: string, typeCode?: string) {
    if (!portal || !fileName) return;
    const doc: OnboardingDocument = {
      id: crypto.randomUUID(),
      kind,
      typeCode,
      fileName,
      uploadedAt: new Date().toISOString(),
      verifyStatus: "pending",
    };
    const rest = portal.documents.filter((d) => {
      if (typeCode) {
        if (d.typeCode) return d.typeCode !== typeCode;
        return d.kind !== kind;
      }
      return d.kind !== kind;
    });
    patchPortal({ documents: [...rest, doc] });
  }

  function onPickFile(docType: PortalDocumentType, file: File | undefined) {
    if (!file) return;
    if (docType.maxSizeMb && file.size > docType.maxSizeMb * 1024 * 1024) {
      setStepError(`${docType.name} must be under ${docType.maxSizeMb} MB.`);
      return;
    }
    setStepError(null);
    upsertDocument(asDocumentKind(docType.kind), file.name, docType.code);
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
    if (!portal.policies.agreed || (!portal.policies.signature.trim() && !portal.policies.signatureDataUrl)) {
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
  const latestDoc = (typeCode: string, kind: string) =>
    [...portal.documents]
      .reverse()
      .find((d) => d.typeCode === typeCode || (!d.typeCode && d.kind === kind));

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
            <SetupField label="Personal email" required hint="Candidate personal email (not company email)">
              <SetupInput
                type="email"
                value={portal.personal.personalEmail || portal.personal.email}
                onChange={(e) =>
                  patchPortal({
                    personal: {
                      ...portal.personal,
                      personalEmail: e.target.value,
                      email: e.target.value,
                    },
                  })
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
            <div className="sm:col-span-2">
              <FilePickField
                label="Photo"
                accept="image/*"
                fileName={portal.personal.photoName}
                hint="Upload from this device (PC or phone) — images only"
                onFile={(file) => {
                  if (!file) return;
                  patchPortal({ personal: { ...portal.personal, photoName: file.name } });
                  upsertDocument("photo", file.name, "DOC-PHOTO");
                }}
              />
            </div>
          </div>
        ) : null}

        {step.id === "government_ids" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SetupField label="Aadhaar" required hint={`Exactly ${AADHAAR_LEN} digits`}>
              <SetupInput
                inputMode="numeric"
                autoComplete="off"
                placeholder={`${"0".repeat(AADHAAR_LEN)}`}
                maxLength={AADHAAR_LEN}
                value={portal.governmentIds.aadhaar}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: {
                      ...portal.governmentIds,
                      aadhaar: digitsOnly(e.target.value).slice(0, AADHAAR_LEN),
                    },
                  })
                }
              />
            </SetupField>
            <SetupField label="PAN" required hint="Format: ABCDE1234F">
              <SetupInput
                autoComplete="off"
                placeholder="ABCDE1234F"
                maxLength={10}
                value={portal.governmentIds.pan}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: {
                      ...portal.governmentIds,
                      pan: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 10),
                    },
                  })
                }
              />
            </SetupField>
            <SetupField label="Passport">
              <SetupInput
                value={portal.governmentIds.passport}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: { ...portal.governmentIds, passport: e.target.value },
                  })
                }
              />
            </SetupField>
            <SetupField label="Driving License">
              <SetupInput
                value={portal.governmentIds.drivingLicense}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: { ...portal.governmentIds, drivingLicense: e.target.value },
                  })
                }
              />
            </SetupField>
            <SetupField label="UAN">
              <SetupInput
                value={portal.governmentIds.uan}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: { ...portal.governmentIds, uan: e.target.value },
                  })
                }
              />
            </SetupField>
            <SetupField label="ESIC">
              <SetupInput
                value={portal.governmentIds.esic}
                onChange={(e) =>
                  patchPortal({
                    governmentIds: { ...portal.governmentIds, esic: e.target.value },
                  })
                }
              />
            </SetupField>
          </div>
        ) : null}

        {step.id === "bank" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SetupField label="Bank name" required>
              <SetupInput
                placeholder="e.g. HDFC Bank"
                value={portal.bank.bankName}
                onChange={(e) =>
                  patchPortal({ bank: { ...portal.bank, bankName: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="Account holder" required>
              <SetupInput
                placeholder="Name as on passbook"
                value={portal.bank.accountHolder}
                onChange={(e) =>
                  patchPortal({ bank: { ...portal.bank, accountHolder: e.target.value } })
                }
              />
            </SetupField>
            <SetupField
              label="Account number"
              required
              hint={`${ACCOUNT_MIN}–${ACCOUNT_MAX} digits`}
            >
              <SetupInput
                inputMode="numeric"
                autoComplete="off"
                placeholder="9 to 18 digit account number"
                maxLength={ACCOUNT_MAX}
                value={portal.bank.accountNumber}
                onChange={(e) =>
                  patchPortal({
                    bank: {
                      ...portal.bank,
                      accountNumber: digitsOnly(e.target.value).slice(0, ACCOUNT_MAX),
                    },
                  })
                }
              />
            </SetupField>
            <SetupField label="IFSC" required hint="11 characters, e.g. HDFC0001234">
              <SetupInput
                autoComplete="off"
                placeholder="HDFC0001234"
                maxLength={11}
                value={portal.bank.ifsc}
                onChange={(e) =>
                  patchPortal({
                    bank: {
                      ...portal.bank,
                      ifsc: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 11),
                    },
                  })
                }
              />
            </SetupField>
            <SetupField label="Branch">
              <SetupInput
                value={portal.bank.branch}
                onChange={(e) =>
                  patchPortal({ bank: { ...portal.bank, branch: e.target.value } })
                }
              />
            </SetupField>
            <SetupField label="UPI">
              <SetupInput
                placeholder="name@upi"
                value={portal.bank.upi}
                onChange={(e) => patchPortal({ bank: { ...portal.bank, upi: e.target.value } })}
              />
            </SetupField>
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
            {docTypes.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                No active document types configured. Ask HR to add types under Setup → Document
                Types.
              </p>
            ) : (
              docTypes.map((t) => (
                <FilePickField
                  key={t.id}
                  label={t.name}
                  required={t.mandatory}
                  accept={t.accept}
                  fileName={latestDoc(t.code, t.kind)?.fileName}
                  hint={
                    t.maxSizeMb
                      ? `Upload from this device · max ${t.maxSizeMb} MB · ${t.code}`
                      : `Upload from this device · ${t.code}`
                  }
                  onFile={(file) => onPickFile(t, file)}
                />
              ))
            )}
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
                  <span className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {p.label}
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setPolicyPreview(p)}
                  >
                    View PDF
                  </button>
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
              <span>
                I agree to the Employee Handbook, NDA, IT Policy, Code of Conduct, and Privacy
                Policy.
                <span className="text-destructive"> *</span>
              </span>
            </label>
            <SetupField
              label="Digital signature"
              required
              hint="Upload signature image (JPG/PNG) or type your full name"
            >
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      patchPortal({
                        policies: {
                          ...portal.policies,
                          signatureFileName: file.name,
                          signatureDataUrl: String(reader.result ?? ""),
                          signature: portal.policies.signature || file.name.replace(/\.[^.]+$/, ""),
                        },
                      });
                      upsertDocument("signature", file.name, "DOC-SIGN");
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {portal.policies.signatureFileName ? (
                  <p className="text-[11px] text-muted-foreground">
                    Uploaded: {portal.policies.signatureFileName}
                  </p>
                ) : null}
                <SetupInput
                  placeholder="Or type full name as signature"
                  value={portal.policies.signature}
                  onChange={(e) =>
                    patchPortal({
                      policies: { ...portal.policies, signature: e.target.value },
                    })
                  }
                />
              </div>
            </SetupField>
          </div>
        ) : null}

        {step.id === "review" ? (
          <div className="space-y-3 text-xs">
            <ReviewRow
              label="Name"
              value={`${portal.personal.firstName} ${portal.personal.lastName}`}
            />
            <ReviewRow label="Personal email" value={portal.personal.personalEmail || portal.personal.email} />
            <ReviewRow label="Aadhaar" value={portal.governmentIds.aadhaar || "—"} />
            <ReviewRow label="PAN" value={portal.governmentIds.pan || "—"} />
            <ReviewRow label="Bank" value={portal.bank.bankName || "—"} />
            <ReviewRow label="Account" value={portal.bank.accountNumber || "—"} />
            <ReviewRow label="Emergency" value={portal.emergency.name || "—"} />
            <ReviewRow label="Documents" value={String(portal.documents.length)} />
            <ReviewRow
              label="Policies"
              value={
                portal.policies.agreed ? `Signed: ${portal.policies.signature}` : "Not accepted"
              }
            />
            <p className="text-muted-foreground">
              After submit, HR will verify documents and activate your employee profile.
            </p>
          </div>
        ) : null}

        {stepError ? (
          <p className="mt-3 rounded-md border border-destructive/30 bg-red-50 px-3 py-2 text-xs text-destructive">
            {stepError}
          </p>
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

      {policyPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-preview-title"
          onClick={() => setPolicyPreview(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h3 id="policy-preview-title" className="text-sm font-semibold">
                {policyPreview.label}
              </h3>
              <button
                type="button"
                className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
                onClick={() => setPolicyPreview(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              <p className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Demo policy preview
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {DEMO_POLICY_BODY[policyPreview.id] ?? "Demo policy content."}
              </pre>
            </div>
            <div className="flex justify-end border-t border-border/70 px-4 py-3">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                onClick={() => setPolicyPreview(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function FilePickField({
  label,
  required,
  accept,
  fileName,
  hint,
  onFile,
}: {
  label: string;
  required?: boolean;
  accept: string;
  fileName?: string;
  hint?: string;
  onFile: (file: File | undefined) => void;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <SetupField label={label} required={required} hint={hint}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-transparent px-2.5 text-sm transition-colors",
          "hover:border-ring hover:bg-muted/40",
        )}
      >
        <Upload className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", fileName ? "text-foreground" : "text-muted-foreground")}>
          {fileName || "Choose file…"}
        </span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </SetupField>
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
