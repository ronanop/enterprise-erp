"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import { SetupDrawer } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import {
  fetchBgPortalAttachments,
  fetchBgPortalStatus,
  sendBgDocumentPortal,
  type BgPortalStatus,
  type BgVendorAttachment,
} from "@/services/bg-check-portal-service";
import type { AtsCandidate, PipelineApplication } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  application: PipelineApplication | null;
  candidate: AtsCandidate | null;
  /** Prefill after invite (status / docs only — never credentials). */
  initial?: Partial<BgPortalStatus> | null;
  onClose: () => void;
  onResent?: () => void;
  onToast?: (message: string, tone?: "success" | "error") => void;
};

const KIND_LABELS: Record<string, string> = {
  aadhaar_card: "Aadhaar card",
  pan_card: "PAN card",
  address_proof: "Address proof",
  other: "Other document",
};

function kindLabel(kind?: string) {
  if (!kind) return "Document";
  return KIND_LABELS[kind] || kind.replace(/_/g, " ");
}

function attachmentDataUrl(att: BgVendorAttachment): string {
  const mime = att.content_type || "application/octet-stream";
  return `data:${mime};base64,${att.content_base64}`;
}

function downloadAttachment(att: BgVendorAttachment) {
  const a = document.createElement("a");
  a.href = attachmentDataUrl(att);
  a.download = att.filename || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function DetailLine({ label, value }: { label: string; value?: string }) {
  const v = String(value || "").trim();
  if (!v) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-[12px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">{v}</dd>
    </div>
  );
}

export function BgPortalCredentialsDrawer({
  open,
  application,
  candidate,
  initial,
  onClose,
  onResent,
  onToast,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<BgPortalStatus | null>(null);
  const [attachments, setAttachments] = useState<BgVendorAttachment[]>([]);
  const [preview, setPreview] = useState<BgVendorAttachment | null>(null);

  const load = useCallback(async () => {
    if (!application?.id) return;
    setLoading(true);
    try {
      const [data, atts] = await Promise.all([
        fetchBgPortalStatus(application.id),
        fetchBgPortalAttachments(application.id).catch(() => [] as BgVendorAttachment[]),
      ]);
      setStatus(data);
      setAttachments(atts);
    } catch {
      setStatus(null);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [application?.id]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      return;
    }
    if (initial?.has_portal || initial?.status || initial?.documents?.length) {
      setStatus({
        bgv_id: initial.bgv_id ?? "",
        status: initial.status ?? "docs_requested",
        submitted_at: initial.submitted_at ?? null,
        document_count: initial.document_count ?? 0,
        expires_at: initial.expires_at ?? null,
        has_portal: initial.has_portal ?? true,
        candidate_name: initial.candidate_name ?? candidate?.fullName ?? null,
        sent_at: initial.sent_at ?? null,
        personal: initial.personal,
        government_ids: initial.government_ids,
        documents: initial.documents,
      });
    }
    void load();
  }, [open, initial, load, candidate?.fullName]);

  const hasPortal = Boolean(status?.has_portal ?? status?.status);
  const name = status?.candidate_name || candidate?.fullName || "Candidate";

  const docs = useMemo(() => {
    const meta = status?.documents ?? [];
    // Prefer kind match first — many uploads reuse the same filename (e.g. singature.jpg).
    const usedAtt = new Set<number>();
    if (meta.length) {
      return meta.map((d) => {
        let attIdx = attachments.findIndex(
          (a, i) => !usedAtt.has(i) && d.kind && a.kind === d.kind,
        );
        if (attIdx < 0) {
          attIdx = attachments.findIndex(
            (a, i) =>
              !usedAtt.has(i) &&
              (a.filename === d.fileName ||
                a.filename?.includes(String(d.id || ""))),
          );
        }
        const att = attIdx >= 0 ? attachments[attIdx]! : null;
        if (attIdx >= 0) usedAtt.add(attIdx);
        return { meta: d, att };
      });
    }
    return attachments.map((att) => ({
      meta: {
        kind: att.kind,
        fileName: att.filename,
        mimeType: att.content_type,
        hasFile: true,
      },
      att,
    }));
  }, [status?.documents, attachments]);

  async function resend() {
    if (!application?.id) return;
    setResending(true);
    try {
      const invite = await sendBgDocumentPortal(application.id);
      onToast?.(
        invite.emailSent
          ? "Portal invite resent to candidate email only"
          : `Portal refreshed${invite.emailError ? ` (email not sent: ${invite.emailError})` : ""}`,
        invite.emailSent ? "success" : "error",
      );
      onResent?.();
      await load();
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Could not resend portal invite", "error");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <SetupDrawer
        open={open}
        onClose={onClose}
        wide
        title="BG portal — details & docs"
        description={`${name} — submitted details and uploaded documents (preview only).`}
        footer={
          <>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={resending || !application?.id}
              onClick={() => void resend()}
            >
              {resending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Resend invite email
            </Button>
          </>
        }
      >
        {loading && !status ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading portal details…
          </div>
        ) : !hasPortal ? (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No portal invite yet. Use{" "}
            <span className="font-medium text-foreground">Resend invite email</span> to
            email the candidate a new link (credentials are not shown here).
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                <Link2 className="size-3" />
                {status?.status === "verified" || status?.status === "cleared"
                  ? "Verified"
                  : status?.status === "rejected" || status?.status === "failed"
                    ? "Rejected"
                    : status?.status === "docs_submitted"
                      ? "Docs submitted"
                      : "Awaiting candidate docs"}
              </span>
              <span>{docs.length} file(s)</span>
              {status?.expires_at ? (
                <span>Expires {new Date(status.expires_at).toLocaleDateString()}</span>
              ) : null}
            </div>

            {(status?.personal || status?.government_ids) && (
              <section className="space-y-2 rounded-md border border-border/70 bg-muted/20 px-3 py-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Candidate details
                </h3>
                <dl className="space-y-1.5">
                  <DetailLine label="Name" value={status.personal?.fullName} />
                  <DetailLine label="Email" value={status.personal?.email} />
                  <DetailLine label="Phone" value={status.personal?.phone} />
                  <DetailLine label="DOB" value={status.personal?.dob} />
                  <DetailLine label="Address" value={status.personal?.address} />
                  <DetailLine
                    label="State / PIN"
                    value={[status.personal?.state, status.personal?.pincode]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <DetailLine label="Aadhaar" value={status.government_ids?.aadhaar} />
                  <DetailLine label="PAN" value={status.government_ids?.pan} />
                </dl>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Uploaded documents
              </h3>
              {loading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Refreshing files…
                </p>
              ) : null}
              {!docs.length ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No documents uploaded yet. Ask the candidate to complete the portal.
                </div>
              ) : (
                <ul className="divide-y divide-border/70 rounded-md border border-border">
                  {docs.map(({ meta, att }, idx) => {
                    const label = kindLabel(meta.kind);
                    const fileName = meta.fileName || att?.filename || "document";
                    return (
                      <li
                        key={String(meta.id || fileName || idx)}
                        className="flex flex-wrap items-center gap-2 px-3 py-2.5"
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{fileName}</p>
                        </div>
                        {att ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer text-[11px]"
                              onClick={() => setPreview(att)}
                            >
                              <Eye className="size-3.5" />
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer text-[11px]"
                              onClick={() => {
                                downloadAttachment(att);
                                onToast?.(`Download started: ${att.filename}`);
                              }}
                            >
                              <Download className="size-3.5" />
                              Download
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">File unavailable</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </SetupDrawer>

      {preview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-slate-950/50"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{kindLabel(preview.kind)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{preview.filename}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="cursor-pointer"
                aria-label="Close"
                onClick={() => setPreview(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-3">
              <DocumentPreviewContent
                fileName={preview.filename}
                dataUrl={attachmentDataUrl(preview)}
                mimeType={preview.content_type}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
