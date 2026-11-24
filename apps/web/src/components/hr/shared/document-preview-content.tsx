"use client";

import { useEffect, useRef, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  classifyDocumentPreview,
  dataUrlToArrayBuffer,
  dataUrlToBlob,
  dataUrlToText,
  isUsablePdfDataUrl,
  resolveDocumentMime,
  triggerDataUrlDownload,
} from "@/lib/document-preview";
import { cn } from "@/lib/utils";

type DocumentPreviewContentProps = {
  fileName: string;
  dataUrl: string;
  mimeType?: string | null;
  className?: string;
  frameClassName?: string;
  /** Hide PDF toolbar / download actions (confidential company documents). */
  viewOnly?: boolean;
};

export function DocumentPreviewContent({
  fileName,
  dataUrl,
  mimeType,
  className,
  frameClassName,
  viewOnly = false,
}: DocumentPreviewContentProps) {
  const kind = classifyDocumentPreview(fileName, mimeType);
  const mime = resolveDocumentMime(fileName, mimeType);

  if (kind === "image") {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={fileName}
          draggable={!viewOnly}
          className={cn(
            "mx-auto max-h-[65vh] w-auto max-w-full rounded-md border border-border/60 object-contain",
            frameClassName,
          )}
        />
      </div>
    );
  }

  if (kind === "pdf") {
    if (!isUsablePdfDataUrl(dataUrl)) {
      return (
        <UnsupportedPreview
          fileName={fileName}
          dataUrl={dataUrl}
          mime={mime}
          message={
            viewOnly
              ? "This policy PDF could not be opened. The written policy text below still applies — contact HR if you need the file."
              : "This PDF file appears empty or corrupted. Try uploading it again."
          }
          className={className}
          viewOnly={viewOnly}
        />
      );
    }
    // View-only: render pages with pdf.js (no browser download/print toolbar).
    if (viewOnly) {
      return (
        <ViewOnlyPdfPages
          fileName={fileName}
          dataUrl={dataUrl}
          className={className}
          frameClassName={frameClassName}
        />
      );
    }
    return (
      <PdfFrame
        fileName={fileName}
        dataUrl={dataUrl}
        className={className}
        frameClassName={frameClassName}
        viewOnly={viewOnly}
      />
    );
  }

  if (kind === "docx") {
    return (
      <DocxPreview
        dataUrl={dataUrl}
        fileName={fileName}
        className={className}
        viewOnly={viewOnly}
      />
    );
  }

  if (kind === "text") {
    return <TextPreview dataUrl={dataUrl} mime={mime} className={className} />;
  }

  if (kind === "spreadsheet") {
    return (
      <SpreadsheetPreview
        dataUrl={dataUrl}
        fileName={fileName}
        className={className}
        viewOnly={viewOnly}
      />
    );
  }

  return (
    <UnsupportedPreview
      fileName={fileName}
      dataUrl={dataUrl}
      mime={mime}
      className={className}
      viewOnly={viewOnly}
    />
  );
}

function useBlockPrintAndContext() {
  useEffect(() => {
    const blockPrintKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.body.classList.add("confidential-print-blocked");
    window.addEventListener("keydown", blockPrintKeys, true);
    return () => {
      document.body.classList.remove("confidential-print-blocked");
      window.removeEventListener("keydown", blockPrintKeys, true);
    };
  }, []);
}

/**
 * Canvas PDF viewer with no browser chrome — no download, print, or edit tools.
 */
function ViewOnlyPdfPages({
  fileName,
  dataUrl,
  className,
  frameClassName,
}: {
  fileName: string;
  dataUrl: string;
  className?: string;
  frameClassName?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useBlockPrintAndContext();

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    setLoading(true);
    setFailed(false);
    setPageCount(0);
    host.replaceChildren();

    void (async () => {
      try {
        const bytes = dataUrlToArrayBuffer(dataUrl);
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setPageCount(doc.numPages);
        const width = Math.max(host.clientWidth || 640, 320);
        for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
          if (cancelled) break;
          const page = await doc.getPage(pageNo);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(1.5, width / base.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className =
            "mx-auto mb-3 block w-full max-w-full rounded border border-border/40 bg-white shadow-sm last:mb-0";
          canvas.setAttribute("aria-label", `${fileName} page ${pageNo}`);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (!cancelled) host.appendChild(canvas);
        }
        await doc.destroy();
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [dataUrl, fileName]);

  if (failed) {
    return (
      <UnsupportedPreview
        fileName={fileName}
        dataUrl={dataUrl}
        mime="application/pdf"
        message="Could not display this policy PDF. Read the policy text below, or contact HR."
        className={className}
        viewOnly
      />
    );
  }

  return (
    <div
      className={cn("relative confidential-no-print", className)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={cn(
          "max-h-[65vh] overflow-y-auto rounded-md border border-border/60 bg-[#E5E7EB] p-3",
          frameClassName,
        )}
      >
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading document…
          </div>
        ) : null}
        <div ref={hostRef} className={loading ? "hidden" : undefined} />
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Confidential · view only
        {pageCount > 0 ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
        {" · "}download and print disabled
      </p>
    </div>
  );
}

/** Blob URL via <embed> for editable/admin previews (browser chrome allowed). */
function PdfFrame({
  fileName,
  dataUrl,
  className,
  frameClassName,
  viewOnly,
}: {
  fileName: string;
  dataUrl: string;
  className?: string;
  frameClassName?: string;
  viewOnly?: boolean;
}) {
  const [src, setSrc] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    setFailed(false);
    try {
      const blob = dataUrlToBlob(dataUrl, "application/pdf");
      if (blob.size < 5) {
        setFailed(true);
        setSrc("");
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    } catch {
      setFailed(true);
      setSrc("");
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dataUrl]);

  if (failed) {
    return (
      <UnsupportedPreview
        fileName={fileName}
        dataUrl={dataUrl}
        mime="application/pdf"
        message={
          viewOnly
            ? "Could not display this policy PDF. Read the policy text below, or contact HR."
            : "Could not display this PDF. Try downloading or re-uploading the file."
        }
        className={className}
        viewOnly={viewOnly}
      />
    );
  }

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-[65vh] items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
          frameClassName,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Loading document…
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-md border border-border/60 bg-white">
        <embed
          title={fileName}
          src={src}
          type="application/pdf"
          className={cn("h-[65vh] w-full bg-white", frameClassName)}
        />
      </div>
    </div>
  );
}

function DocxPreview({
  dataUrl,
  fileName,
  className,
  viewOnly,
}: {
  dataUrl: string;
  fileName: string;
  className?: string;
  viewOnly?: boolean;
}) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml("");

    void (async () => {
      try {
        const mammothMod = (await import("mammoth")) as {
          convertToHtml?: (input: {
            arrayBuffer: ArrayBuffer;
          }) => Promise<{ value: string }>;
          default?: {
            convertToHtml: (input: {
              arrayBuffer: ArrayBuffer;
            }) => Promise<{ value: string }>;
          };
        };
        const convertToHtml =
          mammothMod.convertToHtml ?? mammothMod.default?.convertToHtml;
        if (!convertToHtml) throw new Error("Word preview library failed to load");
        const result = await convertToHtml({
          arrayBuffer: dataUrlToArrayBuffer(dataUrl),
        });
        if (cancelled) return;
        setHtml(result.value || "<p><em>Empty document</em></p>");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not open Word document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Opening Word document…
      </div>
    );
  }

  if (error) {
    return (
      <UnsupportedPreview
        fileName={fileName}
        dataUrl={dataUrl}
        mime={resolveDocumentMime(fileName)}
        message={
          viewOnly
            ? `Could not render this document (${error}). Contact HR for a readable copy.`
            : `Could not render this .docx file (${error}). Download to open in Word.`
        }
        className={className}
        viewOnly={viewOnly}
      />
    );
  }

  return (
    <iframe
      title="Document preview"
      srcDoc={html}
      sandbox=""
      className={cn(
        "w-full rounded-md border border-border/60 bg-white shadow-sm",
        "min-h-[320px] max-h-[65vh]",
        className,
      )}
      onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
    />
  );
}

function TextPreview({
  dataUrl,
  mime,
  className,
}: {
  dataUrl: string;
  mime: string;
  className?: string;
}) {
  const text = dataUrlToText(dataUrl);
  if (!text) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Could not read text from this file.
      </p>
    );
  }

  if (mime === "text/html") {
    return (
      <iframe
        title="HTML preview"
        srcDoc={text}
        sandbox=""
        className={cn(
          "h-[65vh] w-full rounded-md border border-border/60 bg-white",
          className,
        )}
      />
    );
  }

  return (
    <pre
      className={cn(
        "max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-white p-4 text-xs text-foreground",
        className,
      )}
    >
      {text}
    </pre>
  );
}

function SpreadsheetPreview({
  dataUrl,
  fileName,
  className,
  viewOnly,
}: {
  dataUrl: string;
  fileName: string;
  className?: string;
  viewOnly?: boolean;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);

    void (async () => {
      try {
        const { readSheet } = await import("read-excel-file/browser");
        const blob = dataUrlToBlob(dataUrl, resolveDocumentMime(fileName));
        const parsed = (await readSheet(blob)) as unknown[][];
        if (cancelled) return;
        setRows(
          parsed.map((row) =>
            (Array.isArray(row) ? row : []).map((cell) =>
              cell == null ? "" : String(cell),
            ),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not open spreadsheet");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataUrl, fileName]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Opening spreadsheet…
      </div>
    );
  }

  if (error) {
    return (
      <UnsupportedPreview
        fileName={fileName}
        dataUrl={dataUrl}
        mime={resolveDocumentMime(fileName)}
        message={
          viewOnly
            ? `Could not render this spreadsheet (${error}). Contact HR for a readable copy.`
            : `Could not render this spreadsheet (${error}). Download to open in Excel.`
        }
        className={className}
        viewOnly={viewOnly}
      />
    );
  }

  if (!rows.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>Spreadsheet is empty.</p>
    );
  }

  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div
      className={cn(
        "max-h-[65vh] overflow-auto rounded-md border border-border/60 bg-white",
        className,
      )}
    >
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-muted/80">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border-b border-border px-2 py-1.5 font-semibold">
                {cell || `Column ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(body.length ? body : [[]]).map((row, ri) => (
            <tr key={ri} className="odd:bg-muted/20">
              {header.map((_, ci) => (
                <td key={ci} className="border-b border-border/50 px-2 py-1 align-top">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnsupportedPreview({
  fileName,
  dataUrl,
  mime,
  message,
  className,
  viewOnly,
}: {
  fileName: string;
  dataUrl: string;
  mime: string;
  message?: string;
  className?: string;
  viewOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center",
        className,
      )}
    >
      <FileWarning className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {message ??
            (viewOnly
              ? "Preview is not available for this file type. Contact HR if you need access."
              : `In-browser preview is not available for this file type (${mime || "unknown"}). Download the file to open it in the native app.`)}
        </p>
      </div>
      {!viewOnly ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => triggerDataUrlDownload(dataUrl, fileName)}
        >
          Download file
        </Button>
      ) : null}
    </div>
  );
}
