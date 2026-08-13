"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/config/hr-master-options";
import {
  getCaseByToken,
  savePortalProgress,
  submitPortal,
} from "@/services/onboarding-management-service";
import { MAX_DOCUMENT_BYTES, MAX_PHOTO_BYTES, readFileAsDataUrl } from "@/services/employee-management-service";
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
import { POLICY_DOCS, PORTAL_STEPS, emptyEducationMarks } from "@/types/onboarding-management";
import type { PortalDocumentSection } from "@/services/hr-setup-service";

const AADHAAR_LEN = 16;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ACCOUNT_MIN = 9;
const ACCOUNT_MAX = 18;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function hasPassportPhoto(data: PortalPayload): boolean {
  return Boolean(
    data.personal.photoName ||
      data.documents.some((d) => d.kind === "photo" || d.typeCode === "DOC-PHOTO"),
  );
}

function validateStep(
  stepId: PortalStepId,
  portal: PortalPayload,
  docTypes: PortalDocumentType[],
): string | null {
  switch (stepId) {
    case "personal": {
      if (!portal.personal.firstName.trim() || !portal.personal.lastName.trim()) {
        return "First and last name are required.";
      }
      const email = (portal.personal.personalEmail || portal.personal.email).trim();
      if (!email) return "Personal email is required.";
      if (!portal.personal.phone.trim()) return "Phone number is required.";
      if (!portal.personal.address.trim()) return "Current address is required.";
      const permanent = portal.personal.sameAsCurrentAddress
        ? portal.personal.address.trim()
        : (portal.personal.permanentAddress || "").trim();
      if (!permanent) return "Permanent address is required.";
      if (!portal.personal.gender.trim()) return "Gender is required.";
      if (!portal.personal.maritalStatus.trim()) return "Marital status is required.";
      if (!hasPassportPhoto(portal)) return "Passport photo is required.";
      return null;
    }
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
    case "emergency": {
      if (!portal.emergency.name.trim()) return "Emergency contact name is required.";
      if (!portal.emergency.phone.trim()) return "Emergency contact phone number is required.";
      return null;
    }
    case "documents": {
      if (!portal.documents.some((d) => d.kind === "resume" || d.typeCode === "DOC-RESUME")) {
        return "Please upload your Resume (required).";
      }
      const excludedFromMandatory = new Set([
        "DOC-CHEQUE",
        "DOC-GRAD",
        "DOC-SLIPS",
        "DOC-CERT",
        "DOC-REL",
        "doc-type-cheque",
        "doc-type-grad",
        "doc-type-any-cert",
        "doc-type-relieving",
        "doc-type-slips",
        "cancelled_cheque",
        "salary_slips",
        "relieving_letter",
        "other",
      ]);
      const missing = docTypes.filter(
        (t) =>
          t.mandatory &&
          !t.multiple &&
          !excludedFromMandatory.has(t.code) &&
          !excludedFromMandatory.has(t.kind) &&
          !portal.documents.some(
            (d) => d.typeCode === t.code || d.typeCode?.startsWith(`${t.code}-`) || (!d.typeCode && d.kind === t.kind),
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
      const hasSignature =
        Boolean(portal.policies.signature?.trim()) ||
        Boolean(portal.policies.signatureDataUrl) ||
        Boolean(portal.policies.signatureFileName);
      if (!hasSignature) {
        return "Add a digital signature — upload an image or type your full name (either one).";
      }
      return null;
    }
    default:
      return null;
  }
}

const DOC_SECTION_META: {
  id: PortalDocumentSection;
  title: string;
  hint: string;
}[] = [
  {
    id: "education",
    title: "Education",
    hint: "Upload 10th and 12th marksheets",
  },
  {
    id: "identity",
    title: "Bank Details",
    hint: "",
  },
  {
    id: "previous_employment",
    title: "Employment Documents",
    hint: "Resume, relieving letters & salary slips (multi-file, up to 3 each)",
  },
  {
    id: "other",
    title: "Certificates",
    hint: "Optional — upload any additional certificates (multiple files allowed)",
  },
];

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
  const [photoUploading, setPhotoUploading] = useState(false);
  const portalRef = useRef<PortalPayload | null>(null);

  useEffect(() => {
    portalRef.current = portal;
  }, [portal]);

  function currentPortal(): PortalPayload | null {
    return portalRef.current ?? portal;
  }

  function applyPortal(next: PortalPayload) {
    portalRef.current = next;
    setPortal(next);
  }

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
    setPortal({
      ...c.portal,
      educationMarks: c.portal.educationMarks ?? emptyEducationMarks(),
    });
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
    setPortal((p) => {
      if (!p) return p;
      const next = { ...p, ...partial };
      portalRef.current = next;
      return next;
    });
  }

  function go(step: PortalStepId) {
    const p = currentPortal();
    if (!p) return;
    const targetIdx = PORTAL_STEPS.findIndex((s) => s.id === step);
    const currentIdx = PORTAL_STEPS.findIndex((s) => s.id === p.currentStep);
    if (targetIdx > currentIdx) {
      for (let i = currentIdx; i < targetIdx; i += 1) {
        const msg = validateStep(PORTAL_STEPS[i].id, p, docTypes);
        if (msg) {
          setStepError(msg);
          return;
        }
      }
    }
    const next = { ...p, currentStep: step };
    applyPortal(next);
    setStepError(null);
    const saved = savePortalProgress(token, next);
    if (!saved) setStepError("Could not save progress. Please try again.");
  }

  function validateCurrentStep(): string | null {
    const p = currentPortal();
    if (!p) return "Portal not loaded.";
    return validateStep(p.currentStep, p, docTypes);
  }

  function nextStep() {
    const p = currentPortal();
    if (!p) return;
    const msg = validateCurrentStep();
    if (msg) {
      setStepError(msg);
      return;
    }
    setStepError(null);
    let nextPortal = p;
    if (p.currentStep === "government_ids") {
      nextPortal = {
        ...p,
        governmentIds: {
          ...p.governmentIds,
          aadhaar: digitsOnly(p.governmentIds.aadhaar),
          pan: p.governmentIds.pan.trim().toUpperCase(),
        },
      };
    } else if (p.currentStep === "bank") {
      nextPortal = {
        ...p,
        bank: {
          ...p.bank,
          accountNumber: digitsOnly(p.bank.accountNumber),
          ifsc: p.bank.ifsc.trim().toUpperCase(),
        },
      };
    }
    const i = PORTAL_STEPS.findIndex((s) => s.id === p.currentStep);
    if (i >= PORTAL_STEPS.length - 1) {
      applyPortal(nextPortal);
      return;
    }
    const advanced = { ...nextPortal, currentStep: PORTAL_STEPS[i + 1].id };
    applyPortal(advanced);
    const saved = savePortalProgress(token, advanced);
    if (!saved) setStepError("Could not save progress. Please try again.");
  }

  function prevStep() {
    if (!portal) return;
    setStepError(null);
    const i = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
    if (i > 0) go(PORTAL_STEPS[i - 1].id);
  }

  async function upsertDocument(
    kind: DocumentKind,
    file: File,
    typeCode?: string,
    personalPatch?: Partial<PortalPayload["personal"]>,
    options?: { append?: boolean },
  ): Promise<boolean> {
    let fileDataUrl: string;
    try {
      fileDataUrl = await readFileAsDataUrl(file);
    } catch {
      setStepError("Could not read the selected file. Try again.");
      return false;
    }
    const storedTypeCode =
      options?.append && typeCode ? `${typeCode}-${crypto.randomUUID().slice(0, 8)}` : typeCode;
    const doc: OnboardingDocument = {
      id: crypto.randomUUID(),
      kind,
      typeCode: storedTypeCode,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      verifyStatus: "pending",
      fileDataUrl,
      mimeType: file.type || undefined,
    };

    const p = currentPortal();
    if (!p) return false;

    const rest = options?.append
      ? p.documents
      : p.documents.filter((d) => {
          if (typeCode) {
            if (d.typeCode === typeCode) return false;
            // Replace legacy untyped same-kind docs when filling the first slot
            if (
              !d.typeCode &&
              d.kind === kind &&
              (typeCode.endsWith("-1") || !typeCode.includes("-"))
            ) {
              return false;
            }
            return true;
          }
          return d.kind !== kind;
        });
    const nextPortal: PortalPayload = {
      ...p,
      personal: personalPatch ? { ...p.personal, ...personalPatch } : p.personal,
      documents: [...rest, doc],
    };

    applyPortal(nextPortal);
    const saved = savePortalProgress(token, nextPortal);
    if (!saved) {
      setStepError("Could not save the file. Try a smaller image or clear browser storage.");
      return false;
    }
    return true;
  }

  async function removeDocument(docId: string) {
    const p = currentPortal();
    if (!p) return;
    const nextPortal: PortalPayload = {
      ...p,
      documents: p.documents.filter((d) => d.id !== docId),
    };
    applyPortal(nextPortal);
    const saved = savePortalProgress(token, nextPortal);
    if (!saved) setStepError("Could not update documents. Please try again.");
  }

  async function onPickFile(docType: PortalDocumentType, file: File | undefined) {
    if (!file) return;
    if (docType.maxSizeMb && file.size > docType.maxSizeMb * 1024 * 1024) {
      setStepError(`${docType.name} must be under ${docType.maxSizeMb} MB.`);
      return;
    }
    setStepError(null);
    await upsertDocument(asDocumentKind(docType.kind), file, docType.code, undefined, {
      append: Boolean(docType.multiple),
    });
  }

  async function onPickFiles(
    docType: PortalDocumentType,
    files: FileList | null,
    options?: { maxFiles?: number; existingCount?: number },
  ) {
    if (!files?.length) return;
    const maxFiles = options?.maxFiles;
    const existing = options?.existingCount ?? 0;
    const incoming = Array.from(files);
    if (maxFiles != null && existing + incoming.length > maxFiles) {
      setStepError(
        `You can upload up to ${maxFiles} files for ${docType.name}. Remove one to add another.`,
      );
      return;
    }
    setStepError(null);
    for (const file of incoming) {
      if (docType.maxSizeMb && file.size > docType.maxSizeMb * 1024 * 1024) {
        setStepError(`${file.name} must be under ${docType.maxSizeMb} MB.`);
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setStepError(`${file.name} must be under 2 MB.`);
        return;
      }
      const ok = await upsertDocument(asDocumentKind(docType.kind), file, docType.code, undefined, {
        append: true,
      });
      if (!ok) return;
    }
  }

  async function onPickCappedFiles(input: {
    label: string;
    kind: DocumentKind;
    typeCode: string;
    files: FileList | null;
    existingCount: number;
    maxFiles: number;
  }) {
    if (!input.files?.length) return;
    const incoming = Array.from(input.files);
    if (input.existingCount + incoming.length > input.maxFiles) {
      setStepError(
        `You can upload up to ${input.maxFiles} files for ${input.label}. Remove one to add another.`,
      );
      return;
    }
    setStepError(null);
    for (const file of incoming) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        setStepError(`${file.name} must be under 2 MB.`);
        return;
      }
      const ok = await upsertDocument(input.kind, file, input.typeCode, undefined, {
        append: true,
      });
      if (!ok) return;
    }
  }

  async function handleSave() {
    const p = currentPortal();
    if (!p) return;
    setSaving(true);
    try {
      const saved = savePortalProgress(token, p);
      if (!saved) setStepError("Could not save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    const p = currentPortal();
    if (!p) return;
    for (const s of PORTAL_STEPS) {
      const msg = validateStep(s.id, p, docTypes);
      if (msg) {
        setError(msg);
        setStepError(msg);
        return;
      }
    }
    setSaving(true);
    setError(null);
    setStepError(null);
    try {
      const submitted = submitPortal(token, p);
      if (submitted) {
        setDone(true);
        setCaseRow(submitted);
        applyPortal(submitted.portal);
      } else {
        setError("Could not submit onboarding. Please try again.");
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
          <h1 className="mt-3 text-lg font-semibold text-emerald-950">Onboarding Submitted</h1>
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
          {caseRow.entityName ? ` · ${caseRow.entityName}` : ""}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          Welcome, {caseRow.candidateName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your profile before joining on {caseRow.joiningDate || "—"}.
          {caseRow.entityName ? (
            <>
              {" "}
              You are joining <span className="font-medium text-foreground">{caseRow.entityName}</span>.
            </>
          ) : null}{" "}
          Link expires{" "}
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
            <SetupField label="Gender" required>
              <SetupSelect
                value={portal.personal.gender}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, gender: e.target.value } })
                }
              >
                <option value="">Select</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
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
            <SetupField label="Marital status" required>
              <SetupSelect
                value={portal.personal.maritalStatus}
                onChange={(e) =>
                  patchPortal({ personal: { ...portal.personal, maritalStatus: e.target.value } })
                }
              >
                <option value="">Select status</option>
                {MARITAL_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Phone" required>
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
              <SetupField label="Current address" required>
                <SetupTextarea
                  value={portal.personal.address}
                  onChange={(e) => {
                    const address = e.target.value;
                    patchPortal({
                      personal: {
                        ...portal.personal,
                        address,
                        ...(portal.personal.sameAsCurrentAddress
                          ? { permanentAddress: address }
                          : {}),
                      },
                    });
                  }}
                  rows={2}
                />
              </SetupField>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={Boolean(portal.personal.sameAsCurrentAddress)}
                  onChange={(e) => {
                    const same = e.target.checked;
                    patchPortal({
                      personal: {
                        ...portal.personal,
                        sameAsCurrentAddress: same,
                        permanentAddress: same
                          ? portal.personal.address
                          : portal.personal.permanentAddress || "",
                      },
                    });
                  }}
                />
                Permanent address same as current
              </label>
              <SetupField label="Permanent address" required>
                <SetupTextarea
                  value={
                    portal.personal.sameAsCurrentAddress
                      ? portal.personal.address
                      : portal.personal.permanentAddress || ""
                  }
                  onChange={(e) =>
                    patchPortal({
                      personal: {
                        ...portal.personal,
                        sameAsCurrentAddress: false,
                        permanentAddress: e.target.value,
                      },
                    })
                  }
                  rows={2}
                  disabled={Boolean(portal.personal.sameAsCurrentAddress)}
                />
              </SetupField>
            </div>
            <div className="sm:col-span-2">
              <FilePickField
                label="Passport photo"
                required
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                fileName={
                  portal.personal.photoName ||
                  [...portal.documents]
                    .reverse()
                    .find((d) => d.kind === "photo" || d.typeCode === "DOC-PHOTO")?.fileName
                }
                hint={
                  photoUploading
                    ? "Uploading passport photo…"
                    : "Upload from this device (PC or phone) — max 300 KB, JPG or PNG only"
                }
                disabled={photoUploading}
                onFile={async (file) => {
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    setStepError("Passport photo must be an image file (JPG or PNG).");
                    return;
                  }
                  if (file.size > MAX_PHOTO_BYTES) {
                    setStepError("Passport photo must be under 300 KB.");
                    return;
                  }
                  setStepError(null);
                  setPhotoUploading(true);
                  try {
                    const ok = await upsertDocument("photo", file, "DOC-PHOTO", {
                      photoName: file.name,
                    });
                    if (!ok) return;
                    setStepError(null);
                  } finally {
                    setPhotoUploading(false);
                  }
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
              <SetupSelect
                value={portal.emergency.relationship}
                onChange={(e) =>
                  patchPortal({
                    emergency: { ...portal.emergency, relationship: e.target.value },
                  })
                }
              >
                <option value="">Select relationship</option>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Phone" required>
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
          <div className="space-y-5">
            {docTypes.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                No active document types configured. Ask HR to add types under Setup → Document
                Types.
              </p>
            ) : (
              <>
                {DOC_SECTION_META.map((section) => {
                  const types = docTypes.filter(
                    (t) =>
                      t.section === section.id &&
                      t.code !== "DOC-SLIPS" &&
                      t.code !== "DOC-REL",
                  );
                  const showRelieving =
                    section.id === "previous_employment" &&
                    docTypes.some((t) => t.code === "DOC-REL" || t.kind === "relieving_letter");
                  const showSlips =
                    section.id === "previous_employment" &&
                    docTypes.some((t) => t.code === "DOC-SLIPS");
                  if (!types.length && !showSlips && !showRelieving) return null;
                  return (
                    <section
                      key={section.id}
                      className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                        {section.hint ? (
                          <p className="text-[11px] text-muted-foreground">{section.hint}</p>
                        ) : null}
                      </div>
                      <div className="space-y-3">
                        {types.map((t) => {
                          if (t.multiple) {
                            const files = portal.documents.filter(
                              (d) =>
                                d.typeCode === t.code || d.typeCode?.startsWith(`${t.code}-`),
                            );
                            return (
                              <MultiFilePickField
                                key={t.id}
                                label={t.name}
                                required={t.mandatory}
                                accept={t.accept || ".pdf,image/*"}
                                files={files.map((d) => ({ id: d.id, name: d.fileName }))}
                                hint={
                                  t.maxSizeMb
                                    ? `Select multiple files · max ${t.maxSizeMb} MB each`
                                    : "Select multiple files from this device"
                                }
                                onFiles={(list) => void onPickFiles(t, list)}
                                onRemove={(id) => void removeDocument(id)}
                              />
                            );
                          }
                          return (
                            <FilePickField
                              key={t.id}
                              label={
                                t.code === "DOC-CHEQUE"
                                  ? "Cancelled Cheque / Passbook"
                                  : t.name
                              }
                              required={t.mandatory}
                              accept={t.accept || ".pdf,image/*"}
                              fileName={latestDoc(t.code, t.kind)?.fileName}
                              hint={
                                t.maxSizeMb
                                  ? `Upload from this device · max ${t.maxSizeMb} MB`
                                  : "Upload from this device"
                              }
                              onFile={(file) => onPickFile(t, file)}
                            />
                          );
                        })}
                        {showRelieving ? (
                          <MultiFilePickField
                            label="Previous / Latest 3 Relieving Letters"
                            accept=".pdf,image/*,.jpg,.jpeg,.png"
                            files={portal.documents
                              .filter(
                                (d) =>
                                  d.kind === "relieving_letter" ||
                                  d.typeCode === "DOC-REL" ||
                                  d.typeCode?.startsWith("DOC-REL-"),
                              )
                              .map((d) => ({ id: d.id, name: d.fileName }))}
                            hint="Optional — select up to 3 files (latest + previous). PDF, JPG, or PNG · max 2 MB each"
                            maxFiles={3}
                            onFiles={(list) =>
                              void onPickCappedFiles({
                                label: "Previous / Latest 3 Relieving Letters",
                                kind: "relieving_letter",
                                typeCode: "DOC-REL",
                                files: list,
                                existingCount: portal.documents.filter(
                                  (d) =>
                                    d.kind === "relieving_letter" ||
                                    d.typeCode === "DOC-REL" ||
                                    d.typeCode?.startsWith("DOC-REL-"),
                                ).length,
                                maxFiles: 3,
                              })
                            }
                            onRemove={(id) => void removeDocument(id)}
                          />
                        ) : null}
                        {showSlips ? (
                          <MultiFilePickField
                            label="Previous / Latest 3 Salary Slips"
                            accept=".pdf,image/*,.jpg,.jpeg,.png"
                            files={portal.documents
                              .filter(
                                (d) =>
                                  d.kind === "salary_slips" ||
                                  d.typeCode === "DOC-SLIPS" ||
                                  d.typeCode?.startsWith("DOC-SLIPS-"),
                              )
                              .map((d) => ({ id: d.id, name: d.fileName }))}
                            hint="Optional — select up to 3 files (latest + previous). PDF, JPG, or PNG · max 2 MB each"
                            maxFiles={3}
                            onFiles={(list) =>
                              void onPickCappedFiles({
                                label: "Previous / Latest 3 Salary Slips",
                                kind: "salary_slips",
                                typeCode: "DOC-SLIPS",
                                files: list,
                                existingCount: portal.documents.filter(
                                  (d) =>
                                    d.kind === "salary_slips" ||
                                    d.typeCode === "DOC-SLIPS" ||
                                    d.typeCode?.startsWith("DOC-SLIPS-"),
                                ).length,
                                maxFiles: 3,
                              })
                            }
                            onRemove={(id) => void removeDocument(id)}
                          />
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </>
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
              hint="Upload an image or type your full name — either one is enough to continue"
            >
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void (async () => {
                      let fileDataUrl = "";
                      try {
                        fileDataUrl = await readFileAsDataUrl(file);
                      } catch {
                        setStepError("Could not read signature file. Try again.");
                        return;
                      }
                      const policies = {
                        ...portal.policies,
                        signatureFileName: file.name,
                        signatureDataUrl: fileDataUrl,
                        // Keep typed name if already entered; otherwise leave blank — upload alone is enough
                        signature: portal.policies.signature,
                      };
                      patchPortal({ policies });
                      const ok = await upsertDocument("signature", file, "DOC-SIGN");
                      if (!ok) return;
                      setStepError(null);
                    })();
                  }}
                />
                {portal.policies.signatureFileName ? (
                  <p className="text-[11px] text-emerald-700">
                    Uploaded: {portal.policies.signatureFileName}
                  </p>
                ) : null}
                <SetupInput
                  placeholder="Or type full name as signature"
                  value={portal.policies.signature}
                  onChange={(e) => {
                    setStepError(null);
                    patchPortal({
                      policies: { ...portal.policies, signature: e.target.value },
                    });
                  }}
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
            <ReviewRow label="Personal Email" value={portal.personal.personalEmail || portal.personal.email} />
            <ReviewRow label="Aadhaar" value={portal.governmentIds.aadhaar || "—"} />
            <ReviewRow label="PAN" value={portal.governmentIds.pan || "—"} />
            <ReviewRow label="Bank" value={portal.bank.bankName || "—"} />
            <ReviewRow label="Account" value={portal.bank.accountNumber || "—"} />
            <ReviewRow label="Emergency" value={portal.emergency.name || "—"} />
            <ReviewRow
              label="Education"
              value={
                portal.documents
                  .filter(
                    (d) =>
                      d.kind === "education" ||
                      d.typeCode === "DOC-10TH" ||
                      d.typeCode === "DOC-12TH",
                  )
                  .map((d) => d.fileName)
                  .join(", ") || "—"
              }
            />
            <ReviewRow
              label="Certificates"
              value={
                portal.documents
                  .filter((d) => d.typeCode === "DOC-CERT" || d.typeCode?.startsWith("DOC-CERT-"))
                  .map((d) => d.fileName)
                  .join(", ") || "—"
              }
            />
            <ReviewRow
              label="Cancelled Cheque / Passbook"
              value={
                portal.documents.find(
                  (d) => d.typeCode === "DOC-CHEQUE" || d.kind === "cancelled_cheque",
                )?.fileName || "—"
              }
            />
            <ReviewRow
              label="Relieving Letter"
              value={
                portal.documents.find(
                  (d) => d.typeCode === "DOC-REL" || d.kind === "relieving_letter",
                )?.fileName || "—"
              }
            />
            <ReviewRow
              label="Salary Slips"
              value={
                portal.documents
                  .filter(
                    (d) =>
                      d.kind === "salary_slips" ||
                      d.typeCode === "DOC-SLIPS" ||
                      d.typeCode?.startsWith("DOC-SLIPS-"),
                  )
                  .map((d) => d.fileName)
                  .join(", ") || "—"
              }
            />
            <ReviewRow label="Documents" value={String(portal.documents.length)} />
            <ReviewRow
              label="Policies"
              value={
                portal.policies.agreed ? `Signed: ${portal.policies.signature}` : "Not accepted"
              }
            />
            <p className="text-muted-foreground">
              After submit, HR will verify your documents. Employment details are assigned after you join.
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

function FilePickField({
  label,
  required,
  accept,
  fileName,
  hint,
  disabled,
  onFile,
}: {
  label: string;
  required?: boolean;
  accept: string;
  fileName?: string;
  hint?: string;
  disabled?: boolean;
  onFile: (file: File | undefined) => void | Promise<void>;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <SetupField label={label} required={required} hint={hint}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-input bg-transparent px-2.5 text-sm transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-ring hover:bg-muted/40",
          fileName && "border-emerald-300 bg-emerald-50/50",
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
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </SetupField>
  );
}

function MultiFilePickField({
  label,
  required,
  accept,
  files,
  hint,
  maxFiles,
  onFiles,
  onRemove,
}: {
  label: string;
  required?: boolean;
  accept: string;
  files: { id: string; name: string }[];
  hint?: string;
  maxFiles?: number;
  onFiles: (files: FileList | null) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const inputId = `files-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const atLimit = maxFiles != null && files.length >= maxFiles;
  return (
    <SetupField label={label} required={required} hint={hint}>
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-input bg-transparent px-2.5 text-sm transition-colors",
            atLimit
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-ring hover:bg-muted/40",
            files.length > 0 && "border-emerald-300 bg-emerald-50/50",
          )}
        >
          <Upload className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-muted-foreground">
            {atLimit
              ? `Limit reached (${files.length}/${maxFiles})`
              : files.length
                ? `Add more files (${files.length}${maxFiles ? `/${maxFiles}` : ""} uploaded)`
                : maxFiles
                  ? `Choose files… (up to ${maxFiles})`
                  : "Choose files…"}
          </span>
          <input
            id={inputId}
            type="file"
            accept={accept}
            multiple
            disabled={atLimit}
            className="sr-only"
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {files.length ? (
          <ul className="space-y-1">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs"
              >
                <span className="truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  className="cursor-pointer shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => void onRemove(f.id)}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
