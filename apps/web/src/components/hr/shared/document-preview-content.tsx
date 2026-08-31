"use client";

import { useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  classifyDocumentPreview,
  dataUrlToArrayBuffer,
  dataUrlToBlob,
  dataUrlToText,
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

/** Blob URL + #toolbar=0 so Chrome/Edge hide download/print chrome. */
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
  // Personal / policy docs are confidential — always hide browser PDF ribbon.
  const confidential = true;

  useEffect(() => {
    let objectUrl = "";
    try {
      const blob = dataUrlToBlob(dataUrl, "application/pdf");
      objectUrl = URL.createObjectURL(blob);
      // scrollbar stays on so multi-page docs can be read; toolbar/download/print hidden.
      setSrc(`${objectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`);
    } catch {
      setSrc(`${dataUrl}#toolbar=0&navpanes=0&scrollbar=1`);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dataUrl]);

  useEffect(() => {
    if (!confidential) return;
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
  }, [confidential]);

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
    <div
      className={cn("relative confidential-no-print", className)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-border/60 bg-white",
        )}
      >
        <iframe
          title={fileName}
          src={src}
          className={cn("h-[65vh] w-full bg-white", frameClassName)}
        />
      </div>
      {viewOnly || confidential ? (
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Confidential — view only (download and print are disabled)
        </p>
      ) : null}
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
    <div
      className={cn(
        "prose prose-sm max-w-none rounded-md border border-border/60 bg-white p-4 text-foreground shadow-sm dark:prose-invert",
        "max-h-[65vh] overflow-auto",
        className,
      )}
      onContextMenu={viewOnly ? (e) => e.preventDefault() : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
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
