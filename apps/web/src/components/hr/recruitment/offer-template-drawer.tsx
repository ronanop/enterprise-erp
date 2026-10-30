"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, FileText, Loader2, Upload, X } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { composeOfferLetterPdf } from "@/lib/recruitment/compose-offer-letter-pdf";
import {
  applyOfferMergeFields,
  DEFAULT_OFFER_TEMPLATE_BODY,
  OFFER_MERGE_FIELDS,
  sampleOfferMergeValues,
} from "@/lib/recruitment/offer-letter-merge";
import type { OfferLetterTemplate } from "@/types/recruitment-ats";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

type Props = {
  open: boolean;
  initial?: OfferLetterTemplate | null;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    description?: string;
    pdfFileName: string;
    pdfDataUrl: string;
    bodyContent: string;
  }) => void | Promise<void>;
};

export function OfferTemplateDrawer({ open, initial, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfDataUrl, setPdfDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const composeGen = useRef(0);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setBody(initial?.bodyContent || DEFAULT_OFFER_TEMPLATE_BODY);
    setPdfName(initial?.pdfFileName || "");
    setPdfDataUrl(initial?.pdfDataUrl || "");
    setError(null);
    setFullscreen(false);
    setComposedUrl(null);
    setSaving(false);
  }, [open, initial]);

  // Live compose: letterhead + merged sample body → real multi-page PDF preview
  useEffect(() => {
    if (!open || !pdfDataUrl) {
      setComposedUrl(null);
      setComposing(false);
      return;
    }
    const gen = ++composeGen.current;
    setComposing(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const merged = applyOfferMergeFields(body, sampleOfferMergeValues());
          const url = await composeOfferLetterPdf({
            letterheadDataUrl: pdfDataUrl,
            body: merged,
          });
          if (composeGen.current !== gen) return;
          setComposedUrl(url);
          setError(null);
        } catch (e) {
          if (composeGen.current !== gen) return;
          setComposedUrl(null);
          setError(
            e instanceof Error
              ? `Preview failed: ${e.message}`
              : "Could not build PDF preview.",
          );
        } finally {
          if (composeGen.current === gen) setComposing(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, pdfDataUrl, body]);

  const canSave = Boolean(pdfDataUrl && body.trim()) && !saving;

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onPickPdf(file: File | undefined) {
    if (!file) {
      setPdfName("");
      setPdfDataUrl("");
      return;
    }
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("Upload a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("PDF must be 5 MB or smaller.");
      return;
    }
    setError(null);
    setPdfName(file.name);
    setName((prev) => {
      if (prev.trim()) return prev;
      return file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Offer template";
    });
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPdfDataUrl(result.startsWith("data:") ? result : "");
    };
    reader.onerror = () => {
      setError("Could not read PDF.");
      setPdfDataUrl("");
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!pdfDataUrl) {
      setError("Upload a PDF letterhead.");
      return;
    }
    if (!body.trim()) {
      setError("Add body content with merge fields.");
      return;
    }
    const resolvedName =
      name.trim() ||
      pdfName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() ||
      "Offer template";
    setSaving(true);
    setError(null);
    void Promise.resolve(
      onSave({
        id: initial?.id,
        name: resolvedName,
        description: description.trim() || undefined,
        pdfFileName: pdfName || "template.pdf",
        pdfDataUrl,
        bodyContent: body.trim(),
      }),
    )
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not save template.");
      })
      .finally(() => setSaving(false));
  }

  return (
    <>
      <SetupDrawer
        open={open}
        onClose={onClose}
        title={initial ? "Edit offer template" : "Create offer template"}
        description="Upload a one-page letterhead PDF. Body text is stamped onto it; extra pages are created automatically with the same letterhead. Insert fields like Candidate name — they auto-fill when you generate an offer."
        wide
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={!composedUrl}
              onClick={() => setFullscreen(true)}
            >
              <Expand className="size-3.5" />
              Full preview
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={!canSave}
                onClick={handleSave}
              >
                {saving
                  ? "Saving…"
                  : initial
                    ? "Save changes"
                    : "Create template"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <SetupField label="Template name" required>
              <SetupInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard full-time offer"
              />
            </SetupField>
            <SetupField label="Description">
              <SetupInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional short note"
              />
            </SetupField>
            <SetupField
              label="PDF letterhead"
              required
              hint="Single-page PDF (header/footer) · max 5 MB · extra pages reuse this page"
            >
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-5 text-center transition-colors duration-200 hover:border-primary hover:bg-primary/5">
                <Upload className="size-5 text-muted-foreground" />
                <span className="line-clamp-2 px-1 text-[11px] font-medium">
                  {pdfName || "Upload PDF"}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    onPickPdf(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {pdfName ? (
                <button
                  type="button"
                  className="mt-1 cursor-pointer text-[10px] text-destructive hover:underline"
                  onClick={() => onPickPdf(undefined)}
                >
                  Remove PDF
                </button>
              ) : null}
            </SetupField>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-foreground">
                Insert fields (auto-fill on offer generate)
              </p>
              <div className="flex flex-wrap gap-1">
                {OFFER_MERGE_FIELDS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="cursor-pointer rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors duration-150 hover:border-primary hover:bg-primary/5 hover:text-primary"
                    title={`Insert ${f.token}`}
                    onClick={() => insertToken(f.token)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <SetupField
              label="Body content"
              required
              hint="Text is written onto the PDF. Long content creates new pages with the same letterhead."
            >
              <SetupTextarea
                ref={bodyRef}
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-[11px] leading-relaxed"
                placeholder="Use Insert fields above for candidate name, CTC, location…"
              />
            </SetupField>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Live PDF preview</p>
              {composing ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Building pages…
                </span>
              ) : composedUrl ? (
                <span className="text-[10px] text-muted-foreground">
                  Sample data filled into fields
                </span>
              ) : null}
            </div>
            <ComposedPdfPreview
              pdfDataUrl={composedUrl}
              emptyHint={
                pdfDataUrl
                  ? "Building preview…"
                  : "Upload a letterhead PDF to preview text on the page"
              }
              className="min-h-[520px]"
            />
          </div>
        </div>
      </SetupDrawer>

      {fullscreen && composedUrl && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">
                    {name.trim() || "Template preview"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    onClick={() => setFullscreen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 bg-[#E5E7EB] p-2">
                  <iframe
                    title="Offer template full preview"
                    src={`${composedUrl}${composedUrl.includes("#") ? "&" : "#"}toolbar=0&navpanes=0`}
                    className="h-full min-h-[75vh] w-full rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function ComposedPdfPreview({
  pdfDataUrl,
  emptyHint,
  className,
}: {
  pdfDataUrl?: string | null;
  emptyHint?: string;
  className?: string;
}) {
  if (!pdfDataUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 text-muted-foreground",
          className,
        )}
      >
        <FileText className="size-8 opacity-40" />
        <p className="px-4 text-center text-xs">{emptyHint || "No preview"}</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[#E5E7EB]",
        className,
      )}
    >
      <iframe
        title="Offer letter PDF preview"
        src={`${pdfDataUrl}${pdfDataUrl.includes("#") ? "&" : "#"}toolbar=0&navpanes=0`}
        className="h-full min-h-[480px] w-full border-0 bg-white"
      />
    </div>
  );
}

/** @deprecated use ComposedPdfPreview — kept for callers that pass letterhead+body */
export function PdfBodyOverlayPreview({
  pdfDataUrl,
  body,
  className,
}: {
  pdfDataUrl?: string;
  pdfFileName?: string;
  body: string;
  large?: boolean;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!pdfDataUrl) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void composeOfferLetterPdf({
      letterheadDataUrl: pdfDataUrl,
      body: applyOfferMergeFields(body, sampleOfferMergeValues()),
    })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(pdfDataUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfDataUrl, body]);
  return <ComposedPdfPreview pdfDataUrl={url} className={className} />;
}
