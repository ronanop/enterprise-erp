"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Expand,
  FileText,
  Send,
  Upload,
  X,
} from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatInrGrouping,
  parseInrInput,
} from "@/services/recruitment-ats-lookups";
import type {
  AtsCandidate,
  AtsOffer,
  EmploymentType,
  JobOpening,
  OfferTemplateKind,
  PipelineApplication,
} from "@/types/recruitment-ats";
import { OFFER_TEMPLATE_OPTIONS } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  onSubmit: (
    input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt">,
  ) => void;
};

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "part_time", label: "Part Time" },
];

function buildMergedPreview(opts: {
  candidateName: string;
  role: string;
  department: string;
  ctc: number;
  joiningDate: string;
  templateLabel: string;
  notes?: string;
}): string {
  return [
    "OFFER LETTER",
    `Template: ${opts.templateLabel}`,
    "",
    `Dear ${opts.candidateName || "[Candidate Name]"},`,
    "",
    `We are pleased to offer you the position of ${opts.role || "[Role]"} in the ${opts.department || "[Department]"} department.`,
    `Your annual CTC will be ₹${opts.ctc ? formatInrGrouping(opts.ctc) : "[CTC]"}.`,
    opts.joiningDate ? `Proposed joining date: ${opts.joiningDate}.` : "",
    opts.notes ? `\nNotes: ${opts.notes}` : "",
    "",
    "Please confirm acceptance of this offer.",
    "",
    "Regards,",
    "HR Team",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return iso;
  }
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function InrField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[#374151]">{label}</span>
      {hint ? <span className="ml-1 text-[10px] text-[#9CA3AF]">{hint}</span> : null}
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-[#9CA3AF]">
          ₹
        </span>
        <input
          className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-6 pr-3 text-[12px] text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
          inputMode="numeric"
          value={value}
          placeholder={placeholder ?? "0"}
          onChange={(e) => {
            const n = parseInrInput(e.target.value);
            onChange(n ? formatInrGrouping(n) : e.target.value.replace(/[^\d]/g, ""));
          }}
        />
      </div>
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[#374151]">
        {label}
        {required ? <span className="text-[#F43F5E]"> *</span> : null}
      </span>
      <select
        className="h-9 w-full cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[#374151]">
        {label}
        {required ? <span className="text-[#F43F5E]"> *</span> : null}
      </span>
      <input
        type={type}
        className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function OfferDrawer({
  open,
  onClose,
  candidates,
  jobs,
  applications,
  onSubmit,
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [ctcDisplay, setCtcDisplay] = useState("");
  const [basicDisplay, setBasicDisplay] = useState("");
  const [variableDisplay, setVariableDisplay] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("full_time");
  const [notes, setNotes] = useState("");
  const [templateKind, setTemplateKind] = useState<OfferTemplateKind>("standard");
  const [templateFileName, setTemplateFileName] = useState("");
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  const applicationId = useMemo(() => {
    const match = applications.find(
      (a) =>
        a.status === "active" &&
        a.candidateId === candidateId &&
        (!jobId || a.jobId === jobId),
    );
    if (match) return match.id;
    return (
      applications.find((a) => a.candidateId === candidateId && (!jobId || a.jobId === jobId))
        ?.id ?? ""
    );
  }, [applications, candidateId, jobId]);

  const selectedJob = jobs.find((j) => j.id === jobId);
  const selectedCandidate = candidates.find((c) => c.id === candidateId);
  const ctc = parseInrInput(ctcDisplay);
  const basicSalary = parseInrInput(basicDisplay);
  const variablePay = parseInrInput(variableDisplay);

  const departments = useMemo(() => {
    const set = new Set(jobs.map((j) => j.department).filter(Boolean));
    if (department) set.add(department);
    return Array.from(set).sort();
  }, [jobs, department]);

  const locations = useMemo(() => {
    const set = new Set(jobs.map((j) => j.location).filter(Boolean));
    if (location) set.add(location);
    return Array.from(set).sort();
  }, [jobs, location]);

  const managers = useMemo(() => {
    const set = new Set(jobs.map((j) => j.hiringManager).filter(Boolean));
    return Array.from(set).sort();
  }, [jobs]);

  const templateMeta =
    OFFER_TEMPLATE_OPTIONS.find((t) => t.id === templateKind) ?? OFFER_TEMPLATE_OPTIONS[0]!;

  const preview = useMemo(
    () =>
      buildMergedPreview({
        candidateName: selectedCandidate?.fullName ?? "",
        role: selectedJob?.title ?? "",
        department: department || selectedJob?.department || "",
        ctc,
        joiningDate,
        templateLabel: templateFileName || templateMeta.label,
        notes,
      }),
    [
      selectedCandidate,
      selectedJob,
      department,
      ctc,
      joiningDate,
      templateFileName,
      templateMeta.label,
      notes,
    ],
  );

  useEffect(() => {
    if (!open) return;
    setFullscreenPreview(false);
  }, [open]);

  useEffect(() => {
    if (selectedJob?.salaryMax && !ctcDisplay) {
      setCtcDisplay(formatInrGrouping(selectedJob.salaryMax));
    }
  }, [selectedJob, ctcDisplay]);

  function resetForm() {
    setCandidateId("");
    setJobId("");
    setDepartment("");
    setLocation("");
    setJoiningDate("");
    setExpiryDate("");
    setCtcDisplay("");
    setBasicDisplay("");
    setVariableDisplay("");
    setReportingManager("");
    setEmploymentType("full_time");
    setNotes("");
    setTemplateKind("standard");
    setTemplateFileName("");
  }

  function save(asSent: boolean) {
    if (!candidateId || !joiningDate) return;
    onSubmit({
      candidateId,
      jobId: jobId || selectedJob?.id || "",
      applicationId,
      department: department || selectedJob?.department || "General",
      location: location || selectedJob?.location || "",
      joiningDate,
      ctc,
      basicSalary: basicSalary || undefined,
      variablePay: variablePay || undefined,
      reportingManager: reportingManager || undefined,
      employmentType: employmentType || selectedJob?.employmentType || "full_time",
      notes: notes || undefined,
      expiryDate,
      templateKind,
      offerLetterName: templateFileName || `${templateMeta.label}.pdf`,
      templateFileName: templateFileName || `${templateMeta.label}.pdf`,
      mergedPreview: preview,
      status: asSent ? "sent" : "draft",
    });
    onClose();
    resetForm();
  }

  const canSave = Boolean(candidateId && joiningDate);

  if (!open) return null;

  const body = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onClick={() => {
        onClose();
        resetForm();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[min(920px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Generate Offer</h2>
          </div>
          <button
            type="button"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
            aria-label="Close"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body — independent column scroll so left form stays put while preview scrolls */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left column */}
          <div className="erp-scroll min-h-0 space-y-4 overflow-y-auto px-5 py-4 lg:border-r lg:border-[#F3F4F6]">
                <section className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
                    Candidate Information
                  </p>
                  <div className="mt-3">
                    <FieldSelect
                      label="Select candidate"
                      required
                      value={candidateId}
                      onChange={setCandidateId}
                    >
                      <option value="">Choose candidate…</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.candidateCode} · {c.fullName}
                        </option>
                      ))}
                    </FieldSelect>
                  </div>
                  {selectedCandidate ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
                      <InitialsAvatar name={selectedCandidate.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#111827]">
                          {selectedCandidate.fullName}
                        </p>
                        <p className="truncate text-[11px] text-[#6B7280]">
                          {selectedCandidate.email}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#00A866]">
                        Ready for Offer
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <FieldSelect
                      label="Job Role"
                      value={jobId}
                      onChange={(v) => {
                        setJobId(v);
                        const j = jobs.find((x) => x.id === v);
                        if (j) {
                          setDepartment(j.department);
                          setLocation(j.location);
                          setEmploymentType(j.employmentType);
                          if (j.hiringManager) setReportingManager(j.hiringManager);
                          if (j.salaryMax) setCtcDisplay(formatInrGrouping(j.salaryMax));
                        }
                      }}
                    >
                      <option value="">Select job…</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                    </FieldSelect>
                    <FieldSelect
                      label="Department"
                      value={department}
                      onChange={setDepartment}
                    >
                      <option value="">Select…</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </FieldSelect>
                    <FieldSelect label="Location" value={location} onChange={setLocation}>
                      <option value="">Select…</option>
                      {locations.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </FieldSelect>
                    <FieldInput
                      label="Joining Date"
                      type="date"
                      required
                      value={joiningDate}
                      onChange={setJoiningDate}
                    />
                    <FieldInput
                      label="Offer Expiry Date"
                      type="date"
                      value={expiryDate}
                      onChange={setExpiryDate}
                    />
                  </div>
                </section>

                  <section className="rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
                      Compensation Details
                    </p>
                    <div className="mt-3 space-y-3">
                      <InrField
                        label="Annual CTC (₹)"
                        hint="Indian Rupees"
                        value={ctcDisplay}
                        onChange={setCtcDisplay}
                        placeholder="12,00,000"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InrField
                          label="Basic Salary (₹)"
                          value={basicDisplay}
                          onChange={setBasicDisplay}
                        />
                        <InrField
                          label="Variable Pay (₹)"
                          value={variableDisplay}
                          onChange={setVariableDisplay}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
                      Additional Details
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FieldSelect
                        label="Reporting Manager"
                        value={reportingManager}
                        onChange={setReportingManager}
                      >
                        <option value="">Select manager…</option>
                        {managers.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </FieldSelect>
                      <FieldSelect
                        label="Employment Type"
                        value={employmentType}
                        onChange={(v) => setEmploymentType(v as EmploymentType)}
                      >
                        {EMPLOYMENT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </FieldSelect>
                    </div>
                    <label className="mt-3 block space-y-1">
                      <span className="text-[11px] font-medium text-[#374151]">
                        Additional Notes (Optional)
                      </span>
                      <textarea
                        className="min-h-[80px] w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[12px] text-[#111827] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any special clauses or notes…"
                      />
                    </label>
                  </section>
          </div>

          {/* Right column — scrolls independently */}
          <div className="erp-scroll min-h-0 space-y-4 overflow-y-auto px-5 py-4">
                  <section className="rounded-xl border border-[#E5E7EB] p-4">
                    <TemplatePicker
                      templateKind={templateKind}
                      onKindChange={setTemplateKind}
                      templateFileName={templateFileName}
                      onFileName={setTemplateFileName}
                    />
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
                        Preview
                      </p>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[#7C3AED] hover:underline"
                        onClick={() => setFullscreenPreview(true)}
                      >
                        <Expand className="size-3.5" />
                        View Full Screen
                      </button>
                    </div>
                    <OfferLetterPreview
                      candidateName={selectedCandidate?.fullName ?? ""}
                      role={selectedJob?.title ?? ""}
                      department={department || selectedJob?.department || ""}
                      joiningDate={joiningDate}
                      ctc={ctc}
                    />
                  </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] bg-[#FAFBFC] px-5 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 cursor-pointer"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 cursor-pointer"
              disabled={!canSave}
              onClick={() => save(false)}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              className="h-9 cursor-pointer bg-[#7C3AED] hover:bg-[#6D28D9]"
              disabled={!canSave}
              onClick={() => save(true)}
            >
              <Send className="size-3.5" />
              Generate &amp; Send Offer
            </Button>
          </div>
        </div>
      </div>

      {fullscreenPreview
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">Offer Letter Preview</p>
                  <button
                    type="button"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[#F3F4F6]"
                    onClick={() => setFullscreenPreview(false)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="erp-scroll flex-1 overflow-y-auto p-6">
                  <OfferLetterPreview
                    large
                    candidateName={selectedCandidate?.fullName ?? ""}
                    role={selectedJob?.title ?? ""}
                    department={department || selectedJob?.department || ""}
                    joiningDate={joiningDate}
                    ctc={ctc}
                  />
                  <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-3 font-mono text-[11px] text-[#374151]">
                    {preview}
                  </pre>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  return createPortal(body, document.body);
}

function TemplatePicker({
  templateKind,
  onKindChange,
  templateFileName,
  onFileName,
}: {
  templateKind: OfferTemplateKind;
  onKindChange: (k: OfferTemplateKind) => void;
  templateFileName: string;
  onFileName: (n: string) => void;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
          Offer Template
        </p>
        <button
          type="button"
          className="cursor-pointer text-[11px] font-medium text-[#7C3AED] hover:underline"
          onClick={() => undefined}
        >
          Manage Templates
        </button>
      </div>
      <div className="space-y-2">
        {OFFER_TEMPLATE_OPTIONS.map((t) => {
          const selected = templateKind === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-[#7C3AED] bg-[#F5F3FF]"
                  : "border-[#E5E7EB] bg-white hover:border-[#C4B5FD]",
              )}
              onClick={() => onKindChange(t.id)}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-[#7C3AED] bg-[#7C3AED]" : "border-[#D1D5DB]",
                )}
              >
                {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[#111827]">{t.label}</span>
                <span className="mt-0.5 block text-[10px] text-[#6B7280]">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium text-[#374151]">
          Upload Custom Template (Optional)
        </p>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFBFC] px-3 py-6 text-center transition-colors hover:border-[#7C3AED] hover:bg-[#F5F3FF]/40">
          <Upload className="size-5 text-[#9CA3AF]" />
          <span className="text-[11px] font-medium text-[#374151]">
            {templateFileName || "Drag & drop or click to upload"}
          </span>
          <span className="text-[10px] text-[#9CA3AF]">PDF or DOCX · Max 5MB</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              onFileName(f?.name ?? "");
              if (f) onKindChange("custom");
            }}
          />
        </label>
      </div>
    </>
  );
}

function OfferLetterPreview({
  candidateName,
  role,
  department,
  joiningDate,
  ctc,
  large,
}: {
  candidateName: string;
  role: string;
  department: string;
  joiningDate: string;
  ctc: number;
  large?: boolean;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-[#E5E7EB] bg-white shadow-sm",
        large ? "p-8" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#F3F4F6] pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-[#111827] text-[10px] font-bold text-white">
            ACME
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#111827]">Offer Letter</p>
            <p className="text-[10px] text-[#9CA3AF]">{today}</p>
          </div>
        </div>
        <FileText className="size-4 text-[#D1D5DB]" />
      </div>
      <p className={cn("mt-3 text-[#374151]", large ? "text-sm" : "text-[11px]")}>
        Dear <span className="font-semibold">{candidateName || "[Candidate]"}</span>,
      </p>
      <p className={cn("mt-2 text-[#6B7280]", large ? "text-sm" : "text-[10px]")}>
        We are pleased to offer you employment with our organization. Please find the key
        terms below.
      </p>
      <table
        className={cn(
          "mt-3 w-full overflow-hidden rounded-lg border border-[#E5E7EB]",
          large ? "text-[12px]" : "text-[10px]",
        )}
      >
        <tbody>
          <PreviewRow label="Position" value={role || "—"} />
          <PreviewRow label="Department" value={department || "—"} />
          <PreviewRow label="Joining Date" value={formatDisplayDate(joiningDate)} />
          <PreviewRow
            label="Annual CTC"
            value={ctc ? `₹${formatInrGrouping(ctc)}` : "—"}
            last
          />
        </tbody>
      </table>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <tr className={cn(!last && "border-b border-[#F3F4F6]")}>
      <td className="bg-[#F9FAFB] px-2.5 py-1.5 font-medium text-[#6B7280]">{label}</td>
      <td className="px-2.5 py-1.5 font-medium text-[#111827]">{value}</td>
    </tr>
  );
}
