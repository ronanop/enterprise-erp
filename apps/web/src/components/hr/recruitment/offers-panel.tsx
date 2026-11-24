"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { InitialsAvatar } from "@/components/hr/recruitment/dashboard/status-badge";
import {
  OfferTemplateDrawer,
  PdfBodyOverlayPreview,
} from "@/components/hr/recruitment/offer-template-drawer";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import {
  deleteOfferLetterTemplate,
  ensureOfferLetterTemplatesLoaded,
  listOfferLetterTemplates,
  saveOfferLetterTemplate,
} from "@/services/offer-letter-templates-service";
import type {
  AtsCandidate,
  AtsOffer,
  JobOpening,
  OfferLetterTemplate,
  OfferStatus,
} from "@/types/recruitment-ats";
import { OFFER_STATUS_LABELS } from "@/types/recruitment-ats";

const PAGE = 10;

/** Same fill as the Templates tab pill. `!` beats Button's `bg-primary`. */
const STRIP_CTA =
  "!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground";

type Props = {
  offers: AtsOffer[];
  candidates: AtsCandidate[];
  jobs: JobOpening[];
  onSend: (offerId: string) => void;
  /** Resend offer letter email with attachment (offer already sent) */
  onResendLetter?: (offerId: string) => void;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onOnboard: (offer: AtsOffer) => void;
  onboardingOfferId?: string | null;
  onToast?: (message: string, tone?: "error") => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function statusTone(status: OfferStatus): string {
  switch (status) {
    case "draft":
      return "bg-[#F3F4F6] text-[#6B7280]";
    case "sent":
      return "bg-primary/10 text-primary";
    case "accepted":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "rejected":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "expired":
      return "bg-[#FFF7ED] text-[#C2410C]";
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}

export function OffersPanel({
  offers,
  candidates,
  jobs,
  onSend,
  onResendLetter,
  onAccept,
  onDecline,
  onOnboard,
  onboardingOfferId = null,
  onToast,
}: Props) {
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(1);
  const [templates, setTemplates] = useState<OfferLetterTemplate[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OfferLetterTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<OfferLetterTemplate | null>(null);

  function reloadTemplates() {
    setTemplates(listOfferLetterTemplates());
  }

  useEffect(() => {
    void ensureOfferLetterTemplatesLoaded().then(() => reloadTemplates());
  }, []);

  const candMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const departments = useMemo(() => {
    const set = new Set(offers.map((o) => o.department).filter(Boolean));
    return [
      { value: "all", label: "All Departments" },
      ...[...set].sort().map((d) => ({ value: d, label: d })),
    ];
  }, [offers]);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (department !== "all" && o.department !== department) return false;
      return true;
    });
  }, [offers, status, department]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE;
    return filtered.slice(start, start + PAGE);
  }, [filtered, page]);

  return (
    <div className="space-y-5">
      {/* Templates */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Templates</h3>
            <p className="text-[11px] text-[#9CA3AF]">
              PDF letterhead + body merge fields — used when creating offer letters from Pipeline
            </p>
          </div>
          <Button
            size="sm"
            className={cn("h-9 cursor-pointer rounded-full", STRIP_CTA)}
            onClick={() => {
              setEditTemplate(null);
              setTemplateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Create template
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FilePlus2 className="size-5" />
              </div>
              <p className="text-sm font-medium text-[#374151]">No templates yet</p>
              <p className="max-w-sm text-[12px] text-[#9CA3AF]">
                Create a template with your PDF letterhead and overlay body content. Preview shows
                the PDF with text on top.
              </p>
              <Button
                size="sm"
                className={cn("mt-1 cursor-pointer rounded-full", STRIP_CTA)}
                onClick={() => {
                  setEditTemplate(null);
                  setTemplateOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Create template
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[#FAFBFC]"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111827]">{t.name}</p>
                    <p className="truncate text-[11px] text-[#9CA3AF]">
                      {t.pdfFileName}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer"
                      onClick={() => setPreviewTemplate(t)}
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer"
                      onClick={() => {
                        setEditTemplate(t);
                        setTemplateOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (!window.confirm(`Delete template “${t.name}”?`)) return;
                        void deleteOfferLetterTemplate(t.id)
                          .then(() => {
                            reloadTemplates();
                            onToast?.("Template deleted");
                          })
                          .catch((e) =>
                            onToast?.(
                              e instanceof Error ? e.message : "Could not delete template",
                              "error",
                            ),
                          );
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Issued offers (from pipeline) */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Issued offer letters</h3>
          <p className="text-[11px] text-[#9CA3AF]">
            Created from Pipeline (BG check / Negotiation) · PDFs also stored in Documents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            className="w-[140px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:text-[12px]"
          />
          <div className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <FilterSelect
              value={department}
              onChange={(v) => {
                setDepartment(v);
                setPage(1);
              }}
              options={departments}
              className="w-[170px] [&_button]:h-9 [&_button]:rounded-full [&_button]:border-[#E5E7EB] [&_button]:bg-white [&_button]:pl-8 [&_button]:text-[12px]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileCheck2 className="size-5" />
              </div>
              <p className="text-sm font-medium text-[#374151]">No offers yet</p>
              <p className="text-[12px] text-[#9CA3AF]">
                Send an offer from Pipeline (Negotiation Round → Send offer + docs)
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F3F4F6] text-[11px] font-medium tracking-wide text-[#9CA3AF] uppercase">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Offer ID</th>
                      <th className="px-3 py-2.5 font-medium">Candidate</th>
                      <th className="px-3 py-2.5 font-medium">Position</th>
                      <th className="px-3 py-2.5 font-medium">CTC</th>
                      <th className="px-3 py-2.5 font-medium">Join</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o, i) => {
                      const cand = candMap.get(o.candidateId);
                      const job = jobMap.get(o.jobId);
                      return (
                        <tr
                          key={o.id}
                          className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFBFC]"
                        >
                          <td className="px-3 py-2.5 font-medium text-primary">
                            <span className="text-primary">{o.offerCode}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-2">
                              <InitialsAvatar
                                name={cand?.fullName ?? "?"}
                                toneIndex={i}
                                size="sm"
                              />
                              <span className="text-[12px] font-medium text-[#111827]">
                                {cand?.fullName ?? "—"}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#374151]">
                            {job?.title ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#111827]">
                            {o.ctc ? `₹${o.ctc.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#6B7280]">
                            {o.joiningDate || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                statusTone(o.status),
                              )}
                            >
                              {OFFER_STATUS_LABELS[o.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {o.status === "draft" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                  onClick={() => onSend(o.id)}
                                  title="Email offer letter to candidate"
                                >
                                  Send offer + doc link
                                </Button>
                              ) : null}
                              {o.status === "sent" ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 cursor-pointer"
                                    onClick={() => onResendLetter?.(o.id)}
                                    title="Resend offer letter email with attachment"
                                  >
                                    Resend letter
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                    onClick={() => onAccept(o.id)}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 cursor-pointer"
                                    onClick={() => onDecline(o.id)}
                                  >
                                    Decline
                                  </Button>
                                </>
                              ) : null}
                              {o.status === "accepted" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className={cn("h-7 cursor-pointer rounded-full", STRIP_CTA)}
                                  disabled={onboardingOfferId === o.id}
                                  onClick={() => onOnboard(o)}
                                >
                                  {onboardingOfferId === o.id ? "Starting…" : "Onboard"}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2">
                <EmsPagination
                  page={page}
                  pageSize={PAGE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <OfferTemplateDrawer
        open={templateOpen}
        initial={editTemplate}
        onClose={() => {
          setTemplateOpen(false);
          setEditTemplate(null);
        }}
        onSave={async (input) => {
          try {
            await saveOfferLetterTemplate(input);
            reloadTemplates();
            setTemplateOpen(false);
            setEditTemplate(null);
            onToast?.(input.id ? "Template updated" : "Template created");
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Could not save template";
            onToast?.(msg, "error");
            throw e instanceof Error ? e : new Error(msg);
          }
        }}
      />

      {previewTemplate ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{previewTemplate.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {previewTemplate.pdfFileName} · PDF with overlay body
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setPreviewTemplate(null)}
              >
                Close
              </Button>
            </div>
            <div className="erp-scroll flex-1 overflow-y-auto p-4">
              <PdfBodyOverlayPreview
                pdfDataUrl={previewTemplate.pdfDataUrl}
                pdfFileName={previewTemplate.pdfFileName}
                body={previewTemplate.bodyContent}
                large
                className="min-h-[70vh]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
