"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, FileSignature, Printer, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/services/api-client";
import {
  getCompletionCertificate,
  issueCompletionCertificate,
  recordCompletionCertificateSignoff,
  type CompletionCertificate,
} from "@/services/projects-portal-service";

function printCertificate(cert: CompletionCertificate) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const issued = cert.issued_at ? cert.issued_at.slice(0, 10) : "";
  win.document.write(`<!doctype html>
<html><head><title>${cert.certificate_number ?? "Work Completion Certificate"}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; margin: 64px; }
  h1 { font-size: 20px; letter-spacing: .08em; text-transform: uppercase; }
  dl { display: grid; grid-template-columns: 200px 1fr; gap: 8px 16px; font-size: 13px; margin-top: 32px; }
  dt { color: #475569; }
  p.declaration { margin-top: 32px; font-size: 15px; line-height: 1.7; }
  .sign { margin-top: 96px; font-size: 13px; border-top: 1px solid #94a3b8; width: 280px; padding-top: 8px; }
</style></head><body>
<h1>Work Completion Certificate</h1>
<dl>
  <dt>Certificate No.</dt><dd>${cert.certificate_number ?? "-"}</dd>
  <dt>Project</dt><dd>${cert.project_name}</dd>
  <dt>Site</dt><dd>${cert.site_name ?? "-"}</dd>
  <dt>Reference</dt><dd>${cert.document_number}</dd>
  <dt>Issued On</dt><dd>${issued}</dd>
</dl>
<p class="declaration">${cert.declaration}</p>
<div class="sign">Customer signature &amp; name</div>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/**
 * The customer-signed certificate that closes Acceptance. Without it the
 * service invoice cannot be raised and the job cannot back a tender submission.
 */
export function CompletionCertificateCard({
  projectId,
  readOnly,
}: {
  projectId: string;
  readOnly?: boolean;
}) {
  const [cert, setCert] = useState<CompletionCertificate | null>(null);
  const [signatory, setSignatory] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const row = await getCompletionCertificate(projectId);
      setCert(row);
      setSignatory(row.signatory_name ?? "");
      setSignedDate(row.signed_date?.slice(0, 10) ?? "");
      setAttachmentName(row.attachment_name ?? "");
    } catch {
      setCert(null);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!cert) return null;

  async function run(work: () => Promise<CompletionCertificate>) {
    setBusy(true);
    setError(null);
    try {
      setCert(await work());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <FileSignature className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Completion Certificate</h2>
            <p className="text-xs text-muted-foreground">
              Required before Acceptance can be closed.
            </p>
          </div>
        </div>
        {cert.signed ? (
          <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            <BadgeCheck className="mr-1 size-3" />
            Signed by {cert.signatory_name}
          </Badge>
        ) : (
          <Badge className="rounded-full border-transparent bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            {cert.certificate_number ? "Awaiting customer signature" : "Not issued"}
          </Badge>
        )}
      </div>

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Certificate No.
          </dt>
          <dd className="mt-0.5 font-semibold">{cert.certificate_number ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Project
          </dt>
          <dd className="mt-0.5 font-semibold">{cert.project_name}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Signed On
          </dt>
          <dd className="mt-0.5 font-semibold">{cert.signed_date?.slice(0, 10) ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Signed Copy
          </dt>
          <dd className="mt-0.5 font-semibold">{cert.attachment_name ?? "-"}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">{cert.declaration}</p>

      {readOnly ? null : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {cert.certificate_number ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => printCertificate(cert)}
              >
                <Printer className="mr-1.5 size-3.5" />
                Print for signature
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void run(() => issueCompletionCertificate(projectId))}
              >
                Issue certificate
              </Button>
            )}
          </div>

          {cert.certificate_number && !cert.signed ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="sm:col-span-2 space-y-1.5">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Customer signatory *
                </span>
                <Input
                  value={signatory}
                  onChange={(e) => setSignatory(e.target.value)}
                  placeholder="Name of the person who signed"
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Signed on
                </span>
                <Input
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="h-9 cursor-pointer text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Signed copy
                </span>
                <Input
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="File name"
                  className="h-9 text-[13px]"
                />
              </label>
              <div className="sm:col-span-4">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !signatory.trim()}
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() =>
                    void run(() =>
                      recordCompletionCertificateSignoff(projectId, {
                        signatory_name: signatory.trim(),
                        signed_date: signedDate || null,
                        attachment_name: attachmentName.trim() || null,
                      }),
                    )
                  }
                >
                  Record customer sign-off
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
