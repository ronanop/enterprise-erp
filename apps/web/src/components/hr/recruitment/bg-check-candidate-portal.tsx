"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  clearStoredBgPortalAccess,
  fetchBgPortalMeta,
  getStoredBgPortalAccess,
  loginBgPortal,
  saveBgPortal,
  submitBgPortal,
  type BgPortalDocument,
  type BgPortalPayload,
} from "@/services/bg-check-portal-service";

const STEPS = [
  { id: "personal", label: "Personal" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review & submit" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** Same catalog as onboarding Upload Documents, plus Aadhaar / PAN card scans. */
const DOC_SECTIONS: {
  id: string;
  title: string;
  hint: string;
  fields: {
    kind: string;
    label: string;
    required?: boolean;
    multiple?: boolean;
    maxFiles?: number;
  }[];
}[] = [
  {
    id: "government",
    title: "Government IDs",
    hint: "Enter Aadhaar / PAN numbers and upload clear card scans",
    fields: [
      { kind: "aadhaar_card", label: "Aadhaar card (scan / photo)", required: true },
      { kind: "pan_card", label: "PAN card (scan / photo)", required: true },
    ],
  },
  {
    id: "education",
    title: "Education",
    hint: "Upload 10th, 12th, graduation, and post graduate / diploma certificates",
    fields: [
      { kind: "marksheet_10th", label: "10th Marksheet", required: true },
      { kind: "marksheet_12th", label: "12th Marksheet", required: true },
      { kind: "graduation", label: "Graduation", required: true },
      { kind: "pg_diploma", label: "Post Graduate / Diploma" },
    ],
  },
  {
    id: "identity",
    title: "Bank proof",
    hint: "Cancelled cheque or passbook proof",
    fields: [
      { kind: "cancelled_cheque", label: "Cancelled Cheque / Passbook", required: true },
    ],
  },
  {
    id: "previous_employment",
    title: "Employment Documents",
    hint: "Resume, offer & appointment letters, relieving letters & last 3 month salary slip",
    fields: [
      { kind: "resume", label: "Resume", required: true },
      {
        kind: "appointment_letter",
        label: "Previous / Latest Offer & Appointment Letters",
        multiple: true,
        maxFiles: 3,
      },
      {
        kind: "relieving_letter",
        label: "Previous / Latest Relieving Letter",
        multiple: true,
        maxFiles: 3,
      },
      {
        kind: "salary_slips",
        label: "Last 3 Month Salary Slip",
        multiple: true,
        maxFiles: 3,
      },
    ],
  },
  {
    id: "other",
    title: "Certificates",
    hint: "Optional — upload any additional certificates",
    fields: [
      { kind: "other", label: "Any Certificates", multiple: true, maxFiles: 5 },
    ],
  },
];

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring";

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

function isValidPan(value: string): boolean {
  const pan = value.trim().toUpperCase();
  return pan.length === 10 && PAN_RE.test(pan);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function docsOfKind(documents: BgPortalDocument[], kind: string): BgPortalDocument[] {
  return documents.filter((d) => d.kind === kind || d.kind.startsWith(`${kind}-`));
}

export function BgCheckCandidatePortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("personal");
  const [portal, setPortal] = useState<BgPortalPayload | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [candidateName, setCandidateName] = useState<string>("");
  const [loginEmailHint, setLoginEmailHint] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setMetaError(null);
    setError(null);
    try {
      const meta = await fetchBgPortalMeta(token);
      setCandidateName(String(meta.candidate_name || meta.portal?.candidateName || ""));
      setLoginEmailHint(meta.login_email_hint ?? null);
      // Token alone never unlocks the form — always require email + access code.
      if (getStoredBgPortalAccess(token)) {
        clearStoredBgPortalAccess(token);
      }
      setAuthenticated(false);
      setPortal(null);
    } catch (e) {
      setMetaError(e instanceof ApiClientError ? e.message : "Could not open BG portal.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function handleLogin() {
    const email = loginEmail.trim();
    const code = accessCode.trim();
    if (!email || !code) {
      setError("Enter the email and access code from your invite email.");
      return;
    }
    setLoggingIn(true);
    setError(null);
    try {
      const data = await loginBgPortal(token, email, code);
      setPortal(data.portal ?? {});
      setAuthenticated(true);
      if (data.portal?.candidateName) setCandidateName(data.portal.candidateName);
      if (data.portal?.status === "docs_submitted") setStep("review");
    } catch (e) {
      clearStoredBgPortalAccess(token);
      setAuthenticated(false);
      setPortal(null);
      setError(
        e instanceof ApiClientError
          ? e.message
          : "Invalid login email or access code.",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  const stepIdx = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const personal = portal?.personal ?? {};
  const gov = portal?.governmentIds ?? {};
  const documents = portal?.documents ?? [];
  const submitted = portal?.status === "docs_submitted";

  function patchPersonal(patch: NonNullable<BgPortalPayload["personal"]>) {
    setPortal((p) => ({
      ...(p || {}),
      personal: { ...(p?.personal || {}), ...patch },
    }));
  }

  function patchGov(patch: NonNullable<BgPortalPayload["governmentIds"]>) {
    setPortal((p) => ({
      ...(p || {}),
      governmentIds: { ...(p?.governmentIds || {}), ...patch },
    }));
  }

  async function upsertDoc(kind: string, file: File, opts?: { append?: boolean; maxFiles?: number }) {
    setError(null);
    try {
      const fileDataUrl = await readFileAsDataUrl(file);
      const storedKind = opts?.append ? `${kind}-${Date.now()}` : kind;
      const doc: BgPortalDocument = {
        id: crypto.randomUUID(),
        kind: storedKind,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        fileDataUrl,
      };
      setPortal((p) => {
        const existing = p?.documents || [];
        if (opts?.append) {
          const others = existing.filter(
            (d) => !(d.kind === kind || d.kind.startsWith(`${kind}-`)),
          );
          const same = docsOfKind(existing, kind);
          const nextSame =
            opts.maxFiles && same.length >= opts.maxFiles
              ? [...same.slice(-(opts.maxFiles - 1)), doc]
              : [...same, doc];
          return { ...(p || {}), documents: [...others, ...nextSame] };
        }
        const rest = existing.filter((d) => d.kind !== kind && !d.kind.startsWith(`${kind}-`));
        return { ...(p || {}), documents: [...rest, doc] };
      });
    } catch {
      setError("Could not read the selected file.");
    }
  }

  function removeDoc(id: string) {
    setPortal((p) => ({
      ...(p || {}),
      documents: (p?.documents || []).filter((d) => d.id !== id),
    }));
  }

  function validateDocuments(): string | null {
    if (digitsOnly(String(gov.aadhaar || "")).length !== 12) {
      return "Enter a valid 12-digit Aadhaar number.";
    }
    if (!isValidPan(String(gov.pan || ""))) {
      return "Enter a valid PAN (e.g. ABCDE1234F).";
    }
    for (const section of DOC_SECTIONS) {
      for (const field of section.fields) {
        if (!field.required) continue;
        if (docsOfKind(documents, field.kind).length === 0) {
          return `Upload ${field.label}.`;
        }
      }
    }
    return null;
  }

  function validateCurrent(): string | null {
    if (step === "personal") {
      if (!String(personal.fullName || "").trim()) return "Full name is required.";
      if (!String(personal.phone || "").trim()) return "Phone is required.";
      if (!String(personal.address || "").trim()) return "Current address is required.";
      return null;
    }
    if (step === "documents") return validateDocuments();
    return null;
  }

  function handleSessionExpired(e: unknown) {
    if (e instanceof ApiClientError && e.status === 401) {
      clearStoredBgPortalAccess(token);
      setAuthenticated(false);
      setPortal(null);
      setError("Session expired. Sign in again with your email and access code.");
      return true;
    }
    return false;
  }

  async function persist() {
    const res = await saveBgPortal(token, {
      personal: portal?.personal,
      governmentIds: portal?.governmentIds,
      documents: portal?.documents,
    });
    setPortal(res.portal);
    return res.portal;
  }

  async function nextStep() {
    const msg = validateCurrent();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await persist();
      const i = STEPS.findIndex((s) => s.id === step);
      if (i < STEPS.length - 1) setStep(STEPS[i + 1].id);
    } catch (e) {
      if (handleSessionExpired(e)) return;
      setError(e instanceof ApiClientError ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    for (const id of ["personal", "documents"] as const) {
      setStep(id);
      const msg =
        id === "personal"
          ? (() => {
              if (!String(personal.fullName || "").trim()) return "Full name is required.";
              if (!String(personal.phone || "").trim()) return "Phone is required.";
              if (!String(personal.address || "").trim()) return "Current address is required.";
              return null;
            })()
          : validateDocuments();
      if (msg) {
        setError(msg);
        return;
      }
    }
    setStep("review");
    setSaving(true);
    setError(null);
    try {
      const res = await submitBgPortal(token, {
        personal: portal?.personal,
        governmentIds: portal?.governmentIds,
        documents: portal?.documents,
      });
      setPortal(res.portal);
    } catch (e) {
      if (handleSessionExpired(e)) return;
      setError(e instanceof ApiClientError ? e.message : "Submit failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Opening BG document portal…
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-sm shadow-sm">
          <p className="font-semibold text-destructive">Unable to open portal</p>
          <p className="mt-2 text-muted-foreground">{metaError}</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-8">
        <div className="w-full max-w-md space-y-5">
          <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Sign in to BG portal</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {candidateName ? `Hello ${candidateName} — ` : ""}
                  use the email and access code from your invite email.
                  {loginEmailHint ? ` Hint: ${loginEmailHint}` : ""}
                </p>
              </div>
            </div>
          </header>
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <Field label="Email" required>
              <input
                type="email"
                autoComplete="username"
                className={inputClass}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleLogin();
                }}
              />
            </Field>
            <Field label="Access code" required hint="From your invite email">
              <input
                type="password"
                autoComplete="current-password"
                className={cn(inputClass, "font-mono tracking-wide")}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleLogin();
                }}
              />
            </Field>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="button"
              className="w-full cursor-pointer transition-colors duration-200"
              disabled={loggingIn}
              onClick={() => void handleLogin()}
            >
              {loggingIn ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Background check documents</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {portal?.candidateName || candidateName
                  ? `Hello ${portal?.candidateName || candidateName} — `
                  : ""}
                provide personal details and KYC documents (Aadhaar, PAN, marksheets, and more).
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-200",
                  i <= stepIdx ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Step {stepIdx + 1} of {STEPS.length}: {STEPS[stepIdx]?.label}
          </p>
        </header>

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="size-4" /> Documents submitted
            </div>
            <p className="mt-2 text-emerald-900/80">
              Thank you. HR will share these with the background verification partner. You can close
              this page.
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            {step === "personal" ? (
              <div className="space-y-3">
                <Field label="Full name" required>
                  <input
                    className={inputClass}
                    value={personal.fullName || ""}
                    onChange={(e) => patchPersonal({ fullName: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input className={inputClass} value={personal.email || ""} readOnly />
                </Field>
                <Field label="Phone" required>
                  <input
                    className={inputClass}
                    value={personal.phone || ""}
                    onChange={(e) =>
                      patchPersonal({ phone: digitsOnly(e.target.value).slice(0, 10) })
                    }
                  />
                </Field>
                <Field label="Date of birth">
                  <input
                    type="date"
                    className={inputClass}
                    value={personal.dob || ""}
                    onChange={(e) => patchPersonal({ dob: e.target.value })}
                  />
                </Field>
                <Field label="Current address" required>
                  <textarea
                    className={cn(inputClass, "h-auto min-h-[72px] py-2")}
                    value={personal.address || ""}
                    onChange={(e) => patchPersonal({ address: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State">
                    <input
                      className={inputClass}
                      value={personal.state || ""}
                      onChange={(e) => patchPersonal({ state: e.target.value })}
                    />
                  </Field>
                  <Field label="PIN code">
                    <input
                      className={inputClass}
                      value={personal.pincode || ""}
                      onChange={(e) =>
                        patchPersonal({ pincode: digitsOnly(e.target.value).slice(0, 6) })
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {step === "documents" ? (
              <div className="space-y-5">
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Government ID numbers
                      <span className="text-destructive"> *</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Same identity fields previously on a separate step — now part of Documents
                    </p>
                  </div>
                  <Field label="Aadhaar number" required hint="12 digits">
                    <input
                      className={cn(inputClass, "font-mono")}
                      value={gov.aadhaar || ""}
                      onChange={(e) =>
                        patchGov({ aadhaar: digitsOnly(e.target.value).slice(0, 12) })
                      }
                    />
                  </Field>
                  <Field label="PAN" required hint="Format: ABCDE1234F">
                    <input
                      className={cn(inputClass, "font-mono uppercase")}
                      value={gov.pan || ""}
                      onChange={(e) =>
                        patchGov({
                          pan: e.target.value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .slice(0, 10)
                            .toUpperCase(),
                        })
                      }
                    />
                  </Field>
                </div>

                {DOC_SECTIONS.map((section) => (
                  <div
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
                      {section.fields.map((field) => {
                        const files = docsOfKind(documents, field.kind);
                        const existing = files[files.length - 1];
                        if (field.multiple) {
                          return (
                            <div key={field.kind} className="space-y-2">
                              <p className="text-xs font-medium text-foreground">
                                {field.label}
                                {field.required ? (
                                  <span className="text-destructive"> *</span>
                                ) : null}
                              </p>
                              {files.length ? (
                                <ul className="space-y-1">
                                  {files.map((f) => (
                                    <li
                                      key={f.id}
                                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5 text-[11px]"
                                    >
                                      <span className="truncate">{f.fileName}</span>
                                      <button
                                        type="button"
                                        className="cursor-pointer text-destructive hover:underline"
                                        onClick={() => removeDoc(f.id)}
                                      >
                                        Remove
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-3 transition-colors duration-200 hover:bg-muted/40">
                                <span className="text-[11px] text-muted-foreground">
                                  {field.maxFiles
                                    ? `Select up to ${field.maxFiles} files · PDF or image`
                                    : "Select files · PDF or image"}
                                </span>
                                <FileUp className="size-4 shrink-0 text-muted-foreground" />
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,image/*"
                                  multiple
                                  onChange={(e) => {
                                    const list = Array.from(e.target.files || []);
                                    for (const f of list) {
                                      void upsertDoc(field.kind, f, {
                                        append: true,
                                        maxFiles: field.maxFiles,
                                      });
                                    }
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          );
                        }
                        return (
                          <label
                            key={field.kind}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-3 transition-colors duration-200 hover:bg-muted/40",
                              existing && "border-emerald-300 bg-emerald-50/50",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {field.label}
                                {field.required ? (
                                  <span className="text-destructive"> *</span>
                                ) : null}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {existing?.fileName || "PDF or image · max 15 MB"}
                              </p>
                            </div>
                            <FileUp className="size-4 shrink-0 text-muted-foreground" />
                            <input
                              type="file"
                              className="sr-only"
                              accept=".pdf,image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void upsertDoc(field.kind, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {step === "review" ? (
              <div className="space-y-1 text-sm">
                <ReviewRow label="Name" value={personal.fullName || "—"} />
                <ReviewRow label="Phone" value={personal.phone || "—"} />
                <ReviewRow label="Address" value={personal.address || "—"} />
                <ReviewRow
                  label="Aadhaar"
                  value={
                    digitsOnly(String(gov.aadhaar || "")).length === 12
                      ? `XXXX-XXXX-${digitsOnly(String(gov.aadhaar)).slice(-4)}`
                      : "—"
                  }
                />
                <ReviewRow label="PAN" value={gov.pan || "—"} />
                <ReviewRow
                  label="Documents"
                  value={
                    documents.length
                      ? `${documents.length} file(s) · ${documents.map((d) => d.fileName).join(", ")}`
                      : "None uploaded"
                  }
                />
              </div>
            ) : null}

            {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

            <div className="mt-5 flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={stepIdx === 0 || saving}
                onClick={() => {
                  setError(null);
                  if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id);
                }}
              >
                Back
              </Button>
              {step === "review" ? (
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                >
                  {saving ? "Submitting…" : "Submit for BG check"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={saving}
                  onClick={() => void nextStep()}
                >
                  {saving ? "Saving…" : "Continue"}
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border/60 py-2 last:border-0">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
