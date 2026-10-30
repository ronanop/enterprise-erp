"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Expand, FileText, Send, X } from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { composeOfferLetterPdf } from "@/lib/recruitment/compose-offer-letter-pdf";
import { buildOfferLetterFileName } from "@/lib/recruitment/offer-letter-file-name";
import {
  applyOfferMergeFields,
  type OfferMergeValues,
} from "@/lib/recruitment/offer-letter-merge";
import {
  formatInrGrouping,
  parseInrInput,
} from "@/services/recruitment-ats-lookups";
import { ensureOfferLetterTemplatesLoaded } from "@/services/offer-letter-templates-service";
import type {
  AtsCandidate,
  AtsOffer,
  EmploymentType,
  JobOpening,
  OfferLetterTemplate,
  PipelineApplication,
} from "@/types/recruitment-ats";
export type OfferDrawerPrefill = {
  candidateId?: string;
  jobId?: string;
  applicationId?: string;
  department?: string;
  location?: string;
  joiningDate?: string;
  ctc?: number;
  reportingManager?: string;
  employmentType?: EmploymentType | string;
  notes?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  applications: PipelineApplication[];
  initial?: OfferDrawerPrefill | null;
  onSubmit: (
    input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt"> & {
      documentContentDataUrl?: string;
      documentMimeType?: string;
    },
  ) => void;
};

function buildLetterBody(opts: {
  candidateName: string;
  role: string;
  department: string;
  ctc: number;
  joiningDate: string;
  templateKind: "standard" | "internship";
  notes?: string;
}): string {
  const isIntern = opts.templateKind === "internship";
  return [
    `Dear ${opts.candidateName || "[Candidate Name]"},`,
    "",
    isIntern
      ? `We are pleased to offer you an internship for the role of ${opts.role || "[Role]"}${opts.department ? ` in the ${opts.department} department` : ""}.`
      : `We are pleased to offer you the position of ${opts.role || "[Role]"}${opts.department ? ` in the ${opts.department} department` : ""}.`,
    opts.ctc
      ? isIntern
        ? `Your stipend / CTC will be ₹${formatInrGrouping(opts.ctc)}.`
        : `Your annual CTC will be ₹${formatInrGrouping(opts.ctc)}.`
      : "",
    opts.joiningDate ? `Proposed joining date: ${opts.joiningDate}.` : "",
    opts.notes ? `\nNotes: ${opts.notes}` : "",
    "",
    "Please confirm acceptance of this offer.",
    "",
    "Regards,",
    "HR Team",
  ]
    .filter((line) => line !== undefined && line !== "")
    .join("\n");
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
          className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-6 pr-3 text-[12px] text-[#111827] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        className="h-9 w-full cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[#111827] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[#111827] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
  initial = null,
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
  const [templateKind, setTemplateKind] = useState<"standard" | "internship">("standard");
  const [libraryTemplates, setLibraryTemplates] = useState<OfferLetterTemplate[]>([]);
  const [libraryTemplateId, setLibraryTemplateId] = useState<string | null>(null);
  const [letterShellFileName, setLetterShellFileName] = useState("");
  const [letterShellDataUrl, setLetterShellDataUrl] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [letterDirty, setLetterDirty] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composePreviewUrl, setComposePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const candId = initial?.candidateId || "";
    const jId = initial?.jobId || "";
    const job = jobs.find((j) => j.id === jId || j.apiId === jId);
    const empRaw = String(initial?.employmentType || job?.employmentType || "full_time");
    const emp =
      empRaw === "permanent" || empRaw === "full_time"
        ? "full_time"
        : empRaw === "intern"
          ? "intern"
          : empRaw === "contract"
            ? "contract"
            : empRaw === "part_time"
              ? "part_time"
              : "full_time";
    setCandidateId(candId);
    setJobId(jId);
    setDepartment(initial?.department || job?.department || "");
    setLocation(initial?.location || job?.location || "");
    setJoiningDate(initial?.joiningDate || "");
    setExpiryDate("");
    const appMatch = initial?.applicationId
      ? applications.find((a) => a.id === initial.applicationId)
      : applications.find(
          (a) =>
            a.status === "active" &&
            a.candidateId === candId &&
            (!jId || a.jobId === jId),
        );
    const negotiated = appMatch?.negotiatedCtc;
    const ctcSeed = initial?.ctc || negotiated || job?.salaryMax || 0;
    setCtcDisplay(ctcSeed > 0 ? formatInrGrouping(ctcSeed) : "");
    setBasicDisplay("");
    setVariableDisplay("");
    setReportingManager(initial?.reportingManager || job?.hiringManager || "");
    setEmploymentType(emp);
    setNotes(initial?.notes || "");
    setTemplateKind(emp === "intern" ? "internship" : "standard");
    setLetterDirty(false);
    setFullscreenPreview(false);
    setComposePreviewUrl(null);
    setLibraryTemplateId(null);
    setLetterShellFileName("");
    setLetterShellDataUrl("");
    setLetterBody("");
    void ensureOfferLetterTemplatesLoaded().then((templates) => {
      if (!open) return;
      setLibraryTemplates(templates);
      const first = templates[0];
      if (first) {
        setLibraryTemplateId(first.id);
        setLetterShellFileName(first.pdfFileName);
        setLetterShellDataUrl(first.pdfDataUrl);
      }
    });
  }, [open, initial, jobs, applications]);

  const applicationId = useMemo(() => {
    if (initial?.applicationId) return initial.applicationId;
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
  }, [applications, candidateId, jobId, initial?.applicationId]);

  const selectedJob = jobs.find((j) => j.id === jobId);
  const selectedCandidate = candidates.find((c) => c.id === candidateId);
  const ctc = parseInrInput(ctcDisplay);
  const basicSalary = parseInrInput(basicDisplay);
  const variablePay = parseInrInput(variableDisplay);

  const generatedLetter = useMemo(
    () =>
      buildLetterBody({
        candidateName: selectedCandidate?.fullName ?? "",
        role: selectedJob?.title ?? "",
        department: department || selectedJob?.department || "",
        ctc,
        joiningDate,
        templateKind,
        notes,
      }),
    [
      selectedCandidate,
      selectedJob,
      department,
      ctc,
      joiningDate,
      templateKind,
      notes,
    ],
  );

  useEffect(() => {
    if (!open) return;
    if (libraryTemplateId) {
      if (letterDirty) return;
      const tpl = libraryTemplates.find((t) => t.id === libraryTemplateId);
      if (!tpl) return;
      setLetterBody(
        applyOfferMergeFields(tpl.bodyContent, buildMergeValues(), { blankMissing: false }),
      );
      return;
    }
    if (!letterDirty) setLetterBody(generatedLetter);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge from live form fields
  }, [
    open,
    generatedLetter,
    letterDirty,
    libraryTemplateId,
    libraryTemplates,
    candidateId,
    ctc,
    joiningDate,
    department,
    location,
    reportingManager,
    employmentType,
    selectedCandidate,
    selectedJob,
  ]);

  const preview = letterBody || generatedLetter;

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
    setLibraryTemplateId(null);
    setLetterShellFileName("");
    setLetterShellDataUrl("");
    setLetterBody("");
    setLetterDirty(false);
    setComposePreviewUrl(null);
    setSaving(false);
  }

  function buildMergeValues(): OfferMergeValues {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return {
      candidate_full_name: selectedCandidate?.fullName || "",
      candidate_email: selectedCandidate?.email || "",
      candidate_phone: selectedCandidate?.phone || "",
      candidate_address: selectedCandidate?.address || selectedCandidate?.location || "",
      company_name: "Cache Digitech",
      company_address: location || selectedJob?.location || "",
      company_location: location || selectedJob?.location || "",
      company_email: "hr@cachedigitech.com",
      company_website: "www.cachedigitech.com",
      role: selectedJob?.title || "",
      department: department || selectedJob?.department || "",
      ctc: ctc > 0 ? `₹${formatInrGrouping(ctc)}` : "",
      joining_date: joiningDate || "",
      reporting_manager: reportingManager || selectedJob?.hiringManager || "",
      employment_type:
        employmentType === "full_time"
          ? "Full Time"
          : employmentType === "intern"
            ? "Intern"
            : employmentType === "contract"
              ? "Contract"
              : employmentType === "part_time"
                ? "Part Time"
                : String(employmentType || ""),
      offer_date: `${dd}/${mm}/${yyyy}`,
      offer_code: "",
    };
  }

  function applyLibraryTemplate(tpl: OfferLetterTemplate) {
    setLibraryTemplateId(tpl.id);
    setLetterShellFileName(tpl.pdfFileName);
    setLetterShellDataUrl(tpl.pdfDataUrl);
    const merged = applyOfferMergeFields(tpl.bodyContent, buildMergeValues(), {
      blankMissing: false,
    });
    setLetterBody(merged);
    setLetterDirty(false);
  }

  // Compose letterhead + body for live PDF preview when a shell is present
  useEffect(() => {
    if (!open || !letterShellDataUrl) {
      setComposePreviewUrl(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void composeOfferLetterPdf({
        letterheadDataUrl: letterShellDataUrl,
        body: letterBody || generatedLetter,
      })
        .then((url) => {
          if (!cancelled) setComposePreviewUrl(url);
        })
        .catch(() => {
          if (!cancelled) setComposePreviewUrl(letterShellDataUrl);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, letterShellDataUrl, letterBody, generatedLetter]);

  async function save(asSent: boolean) {
    if (!candidateId || !joiningDate || saving) return;
    const letterName = buildOfferLetterFileName({
      candidateName: selectedCandidate?.fullName,
      role: selectedJob?.title,
    });
    const templatePdfName =
      letterShellFileName ||
      (templateKind === "internship" ? "internship-offer-letter.pdf" : "standard-offer-letter.pdf");
    setSaving(true);
    try {
      let documentContentDataUrl = letterShellDataUrl || undefined;
      if (letterShellDataUrl) {
        try {
          documentContentDataUrl = await composeOfferLetterPdf({
            letterheadDataUrl: letterShellDataUrl,
            body: letterBody || generatedLetter,
          });
        } catch {
          /* keep letterhead-only if compose fails */
        }
      }
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
        offerLetterName: letterName,
        templateFileName: templatePdfName,
        mergedPreview: preview,
        status: asSent ? "sent" : "draft",
        documentContentDataUrl,
        documentMimeType: documentContentDataUrl ? "application/pdf" : undefined,
      });
      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    Boolean(candidateId && joiningDate && libraryTemplateId && letterShellDataUrl) && !saving;

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
        className="flex h-[min(880px,94vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Send offer</h2>
            <p className="mt-0.5 text-[12px] text-[#6B7280]">
              Select a letter template and preview the full offer before sending
            </p>
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

        <div className="erp-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {selectedCandidate ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3">
              <InitialsAvatar name={selectedCandidate.fullName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#111827]">
                  {selectedCandidate.fullName}
                </p>
                <p className="truncate text-[11px] text-[#6B7280]">
                  {selectedJob?.title || "Role"}
                  {ctc > 0 ? ` · CTC ₹${formatInrGrouping(ctc)}` : ""}
                  {joiningDate ? ` · Join ${joiningDate}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <section className="rounded-xl border border-[#E5E7EB] p-4">
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
                <FieldInput
                  label="Joining Date"
                  type="date"
                  required
                  value={joiningDate}
                  onChange={setJoiningDate}
                />
                <InrField
                  label="Annual CTC (₹)"
                  value={ctcDisplay}
                  onChange={setCtcDisplay}
                  placeholder="12,00,000"
                />
              </div>
            </section>
          )}

          {!joiningDate || !ctcDisplay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {!joiningDate ? (
                <FieldInput
                  label="Joining Date"
                  type="date"
                  required
                  value={joiningDate}
                  onChange={setJoiningDate}
                />
              ) : null}
              {!ctcDisplay ? (
                <InrField
                  label="Annual CTC (₹)"
                  value={ctcDisplay}
                  onChange={setCtcDisplay}
                  placeholder="12,00,000"
                />
              ) : null}
            </div>
          ) : null}

          <section className="rounded-xl border border-[#E5E7EB] p-4">
            <TemplatePicker
              libraryTemplates={libraryTemplates}
              libraryTemplateId={libraryTemplateId}
              onSelectLibrary={(tpl) => applyLibraryTemplate(tpl)}
            />
          </section>

          <section className="rounded-xl border border-[#E5E7EB] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
                Full offer preview
              </p>
              {composePreviewUrl ? (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  onClick={() => setFullscreenPreview(true)}
                >
                  <Expand className="size-3.5" />
                  Full screen
                </button>
              ) : null}
            </div>
            {composePreviewUrl ? (
              <iframe
                title="Full offer letter preview"
                src={`${composePreviewUrl}${composePreviewUrl.includes("#") ? "&" : "#"}toolbar=0&navpanes=0`}
                className="h-[min(520px,50vh)] w-full rounded-lg border border-[#E5E7EB] bg-white"
              />
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-4 py-8 text-center">
                <FileText className="size-8 text-[#D1D5DB]" />
                <p className="text-[12px] text-[#6B7280]">
                  {libraryTemplates.length
                    ? "Select a template above to preview the full offer letter"
                    : "Create a template under Templates → Create template first"}
                </p>
              </div>
            )}
          </section>
        </div>

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
              onClick={() => void save(false)}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              className="h-9 cursor-pointer bg-primary hover:bg-primary/90"
              disabled={!canSave}
              onClick={() => void save(true)}
            >
              <Send className="size-3.5" />
              {saving ? "Preparing…" : "Send offer + document link"}
            </Button>
          </div>
        </div>
      </div>

      {fullscreenPreview && composePreviewUrl
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">Full offer preview</p>
                  <button
                    type="button"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[#F3F4F6]"
                    onClick={() => setFullscreenPreview(false)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 bg-[#E5E7EB] p-2">
                  <iframe
                    title="Full offer letter"
                    src={`${composePreviewUrl}${composePreviewUrl.includes("#") ? "&" : "#"}toolbar=0&navpanes=0`}
                    className="h-full min-h-[75vh] w-full rounded-lg bg-white"
                  />
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
  libraryTemplates,
  libraryTemplateId,
  onSelectLibrary,
}: {
  libraryTemplates: OfferLetterTemplate[];
  libraryTemplateId: string | null;
  onSelectLibrary: (tpl: OfferLetterTemplate) => void;
}) {
  return (
    <>
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-[#6B7280] uppercase">
        Offer template
      </p>
      {libraryTemplates.length === 0 ? (
        <p className="text-[12px] text-[#6B7280]">
          No templates yet. Create one under Templates → Create template, then return here to send.
        </p>
      ) : (
        <div className="space-y-2">
          {libraryTemplates.map((t) => {
            const selected = libraryTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-[#E5E7EB] bg-white hover:border-primary/40",
                )}
                onClick={() => onSelectLibrary(t)}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary" : "border-[#D1D5DB]",
                  )}
                >
                  {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-[#111827]">{t.name}</span>
                  <span className="mt-0.5 block text-[10px] text-[#6B7280]">
                    {t.pdfFileName}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
