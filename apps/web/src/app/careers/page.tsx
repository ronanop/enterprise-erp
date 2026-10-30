"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatInrGrouping,
  INDIAN_STATES,
  isValidEmail,
  isValidIndianMobile,
  isValidPincode,
  parseInrInput,
} from "@/services/recruitment-ats-lookups";
import {
  listPublicCareerRoles,
  submitCareerApplication,
  type PublicCareerRole,
} from "@/services/careers-public-service";

const SKILL_TONES = [
  "bg-primary/10 text-primary",
  "bg-emerald-50 text-emerald-800",
  "bg-amber-50 text-amber-900",
  "bg-sky-50 text-sky-800",
];

type ApplyFormState = {
  fullName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  gender: string;
  dob: string;
  address: string;
  state: string;
  pincode: string;
  currentCompany: string;
  currentDesignation: string;
  experienceYears: string;
  expectedSalaryDisplay: string;
  noticePeriodDays: string;
  skills: string[];
  skillDraft: string;
  resume: File | null;
  portfolioUrl: string;
  linkedinUrl: string;
};

const EMPTY_FORM: ApplyFormState = {
  fullName: "",
  email: "",
  phone: "",
  alternatePhone: "",
  gender: "",
  dob: "",
  address: "",
  state: "",
  pincode: "",
  currentCompany: "",
  currentDesignation: "",
  experienceYears: "0",
  expectedSalaryDisplay: "",
  noticePeriodDays: "30",
  skills: [],
  skillDraft: "",
  resume: null,
  portfolioUrl: "",
  linkedinUrl: "",
};

function experienceLabel(role: PublicCareerRole): string {
  const min = role.experience_min;
  const max = role.experience_max;
  if (min == null && max == null) return "Experience not specified";
  if (min != null && max != null) return `${min}–${max} yrs experience`;
  if (min != null) return `${min}+ yrs experience`;
  return `Up to ${max} yrs experience`;
}

function salaryLabel(role: PublicCareerRole): string | null {
  const min = role.salary_min;
  const max = role.salary_max;
  if (min == null && max == null) return null;
  const currency = role.currency_code || "INR";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency === "INR" ? "INR" : currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function openingsLeft(role: PublicCareerRole): number {
  const filled = role.filled ?? 0;
  return Math.max(0, (role.openings ?? 0) - filled);
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5 text-xs font-medium text-foreground", className)}>
      <span>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[10px] font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export default function CareersPage() {
  const [roles, setRoles] = useState<PublicCareerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ title: string; detail?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ApplyFormState>(EMPTY_FORM);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await listPublicCareerRoles();
        setRoles(list);
      } catch (e) {
        setRoles([]);
        setError(e instanceof Error ? e.message : "Could not load open roles");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patchForm(partial: Partial<ApplyFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function addSkill() {
    const chunks = form.skillDraft
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!chunks.length) return;
    patchForm({
      skills: Array.from(new Set([...form.skills, ...chunks])),
      skillDraft: "",
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (!selected) {
      setError("Select an open role");
      return;
    }
    if (!form.fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (!isValidEmail(form.email)) {
      setError("Enter a valid email");
      return;
    }
    if (!isValidIndianMobile(form.phone)) {
      setError("Enter a valid 10-digit mobile starting with 6–9");
      return;
    }
    if (form.alternatePhone && !isValidIndianMobile(form.alternatePhone)) {
      setError("Alternate phone must be a valid 10-digit mobile");
      return;
    }
    if (!form.gender) {
      setError("Gender is required");
      return;
    }
    if (!form.dob) {
      setError("Date of birth is required");
      return;
    }
    if (!form.address.trim()) {
      setError("Address is required");
      return;
    }
    if (!form.state) {
      setError("State is required");
      return;
    }
    if (!isValidPincode(form.pincode)) {
      setError("Pincode must be 6 digits");
      return;
    }
    if (!form.skills.length) {
      setError("Add at least one skill");
      return;
    }
    if (!form.resume) {
      setError("Resume is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitCareerApplication({
        jobRequisitionId: selected.id,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone,
        resume: form.resume,
        alternatePhone: form.alternatePhone || undefined,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        address: form.address || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        currentCompany: form.currentCompany || undefined,
        currentDesignation: form.currentDesignation || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : 0,
        expectedSalary: form.expectedSalaryDisplay
          ? parseInrInput(form.expectedSalaryDisplay)
          : undefined,
        noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : undefined,
        skills: form.skills,
        portfolioUrl: form.portfolioUrl || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
      });
      setSuccess(
        res.duplicate
          ? {
              title: "You’ve already applied for this role",
              detail: "Our team has your application and will be in touch soon.",
            }
          : {
              title: "Thank you for applying!",
              detail: "We’ve received your application and will review it shortly.",
            },
      );
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.004_220)]">
      <header className="border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Briefcase className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">Careers</p>
            <p className="text-xs text-muted-foreground">Open roles hiring now</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading open roles…
          </div>
        ) : selected ? (
          <JobDetailView
            role={selected}
            error={error}
            success={success}
            submitting={submitting}
            form={form}
            onBack={() => {
              setSelectedId(null);
              setError("");
              setSuccess(null);
              setForm(EMPTY_FORM);
            }}
            onPatch={patchForm}
            onAddSkill={addSkill}
            onSubmit={onSubmit}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Open positions
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {roles.length
                    ? `${roles.length} role${roles.length === 1 ? "" : "s"} accepting applications`
                    : "No open roles are published yet."}
                </p>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            {roles.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(role.id);
                      setError("");
                      setSuccess(null);
                      setForm(EMPTY_FORM);
                    }}
                    className={cn(
                      "group flex h-full cursor-pointer flex-col rounded-xl border border-border/70 bg-card p-5 text-left shadow-sm",
                      "transition-colors duration-200 hover:border-primary/35 hover:bg-accent/40",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-foreground">
                          {role.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {role.job_code}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                          External
                        </span>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary capitalize">
                          {role.employment_type || "Full-time"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        {experienceLabel(role)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {openingsLeft(role)} opening{openingsLeft(role) === 1 ? "" : "s"}
                      </span>
                      {role.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {role.location}
                        </span>
                      ) : null}
                    </div>

                    {role.description ? (
                      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-foreground/80">
                        {role.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-[13px] text-muted-foreground">
                        Click to view role details and apply
                      </p>
                    )}

                    <span className="mt-4 text-[12px] font-semibold text-primary transition-opacity duration-150 group-hover:opacity-90">
                      View details →
                    </span>
                  </button>
                ))}
              </div>
            ) : !error ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
                <Briefcase className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">No open roles right now</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check back soon — new openings appear here when published.
                </p>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function JobDetailView({
  role,
  error,
  success,
  submitting,
  form,
  onBack,
  onPatch,
  onAddSkill,
  onSubmit,
}: {
  role: PublicCareerRole;
  error: string;
  success: { title: string; detail?: string } | null;
  submitting: boolean;
  form: ApplyFormState;
  onBack: () => void;
  onPatch: (partial: Partial<ApplyFormState>) => void;
  onAddSkill: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const pay = salaryLabel(role);
  const selectClass =
    "flex h-10 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to open positions
      </button>

      <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {role.job_code}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {role.title}
            </h1>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary capitalize">
            {role.employment_type || "Full-time"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Experience", experienceLabel(role)],
            ["Openings", String(openingsLeft(role))],
            ["Location", role.location || "Not specified"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
            >
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold capitalize text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {pay ? (
          <p className="mt-3 text-[13px] text-foreground/85">
            <span className="font-medium text-foreground">Compensation:</span> {pay}
          </p>
        ) : null}

        <div className="mt-5 border-t border-border/60 pt-5">
          <h2 className="text-sm font-semibold text-foreground">About this role</h2>
          {role.description ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {role.description}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Job description will be shared during the hiring process. You can still apply below.
            </p>
          )}
        </div>
      </section>

      {success ? (
        <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3"
          >
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-emerald-900">{success.title}</p>
              {success.detail ? (
                <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800/90">
                  {success.detail}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={onBack}
          >
            Back to open positions
          </Button>
        </section>
      ) : (
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">Apply for this role</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Applying to <span className="font-medium text-foreground">{role.title}</span>
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Field label="Full name" required>
          <Input
            value={form.fullName}
            onChange={(e) => onPatch({ fullName: e.target.value })}
            required
            className="h-10"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => onPatch({ email: e.target.value })}
              required
              className="h-10"
            />
          </Field>
          <Field label="Phone" required hint="10-digit mobile">
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) =>
                onPatch({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
              required
              placeholder="9876543210"
              className="h-10"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alternate phone">
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.alternatePhone}
              onChange={(e) =>
                onPatch({ alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
              className="h-10"
            />
          </Field>
          <Field label="Gender" required>
            <select
              value={form.gender}
              onChange={(e) => onPatch({ gender: e.target.value })}
              required
              className={selectClass}
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        <Field label="DOB" required>
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => onPatch({ dob: e.target.value })}
            required
            className="h-10"
          />
        </Field>

        <Field label="Address" required>
          <Input
            value={form.address}
            onChange={(e) => onPatch({ address: e.target.value })}
            placeholder="House / street / locality"
            required
            className="h-10"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State" required>
            <select
              value={form.state}
              onChange={(e) => onPatch({ state: e.target.value })}
              required
              className={selectClass}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pincode" required hint="6 digits">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) =>
                onPatch({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              placeholder="110001"
              required
              className="h-10"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current company">
            <Input
              value={form.currentCompany}
              onChange={(e) => onPatch({ currentCompany: e.target.value })}
              className="h-10"
            />
          </Field>
          <Field label="Current designation">
            <Input
              value={form.currentDesignation}
              onChange={(e) => onPatch({ currentDesignation: e.target.value })}
              className="h-10"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Experience (yrs)">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.experienceYears}
              onChange={(e) => onPatch({ experienceYears: e.target.value })}
              className="h-10"
            />
          </Field>
          <Field label="Expected salary (₹)">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₹
              </span>
              <Input
                className="h-10 pl-6"
                inputMode="numeric"
                value={form.expectedSalaryDisplay}
                onChange={(e) => {
                  const n = parseInrInput(e.target.value);
                  onPatch({
                    expectedSalaryDisplay: n
                      ? formatInrGrouping(n)
                      : e.target.value.replace(/[^\d]/g, ""),
                  });
                }}
                placeholder="8,00,000"
              />
            </div>
          </Field>
          <Field label="Notice period (days)">
            <Input
              type="number"
              min={0}
              value={form.noticePeriodDays}
              onChange={(e) => onPatch({ noticePeriodDays: e.target.value })}
              className="h-10"
            />
          </Field>
        </div>

        <Field
          label="Skills"
          required
          hint="Type a skill and press Enter, or paste comma-separated"
        >
          <div className="space-y-2">
            {form.skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {form.skills.map((skill, i) => (
                  <span
                    key={skill}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      SKILL_TONES[i % SKILL_TONES.length],
                    )}
                  >
                    {skill}
                    <button
                      type="button"
                      aria-label={`Remove ${skill}`}
                      className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full transition-opacity duration-150 hover:opacity-70"
                      onClick={() =>
                        onPatch({ skills: form.skills.filter((s) => s !== skill) })
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                value={form.skillDraft}
                onChange={(e) => onPatch({ skillDraft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    onAddSkill();
                  }
                }}
                placeholder="e.g. React, Python, SQL"
                className="h-10"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 cursor-pointer px-3"
                onClick={onAddSkill}
                disabled={!form.skillDraft.trim()}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>
        </Field>

        <Field label="Resume upload" required hint="PDF, DOC, DOCX, or TXT">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted/40">
              <Upload className="size-3.5" />
              {form.resume ? form.resume.name : "No file chosen"}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                required={!form.resume}
                onChange={(e) => onPatch({ resume: e.target.files?.[0] ?? null })}
              />
            </label>
            {form.resume ? (
              <button
                type="button"
                className="cursor-pointer text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => onPatch({ resume: null })}
              >
                Clear
              </button>
            ) : null}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Portfolio URL">
            <Input
              type="url"
              value={form.portfolioUrl}
              onChange={(e) => onPatch({ portfolioUrl: e.target.value })}
              placeholder="https://"
              className="h-10"
            />
          </Field>
          <Field label="LinkedIn">
            <Input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => onPatch({ linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/…"
              className="h-10"
            />
          </Field>
        </div>

        <Button type="submit" disabled={submitting} className="cursor-pointer">
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit application"
          )}
        </Button>
      </form>
      )}
    </div>
  );
}
