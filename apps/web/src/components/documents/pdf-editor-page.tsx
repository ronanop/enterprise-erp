"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  FileUp,
  PenLine,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  canvasPointToPdf,
  defaultTextFor,
  downloadBytes,
  flattenAnnotations,
  fontSizeFor,
  pdfPointToCanvas,
  type AnnotationKind,
  type PdfAnnotation,
} from "@/lib/pdf/pdf-annotations";

const TOOLS: { kind: AnnotationKind; label: string; icon: typeof Type }[] = [
  { kind: "text", label: "Text", icon: Type },
  { kind: "date", label: "Date", icon: CalendarDays },
  { kind: "signature", label: "Signature", icon: PenLine },
  { kind: "check", label: "Tick", icon: Check },
];

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];

export function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceBytesRef = useRef<ArrayBuffer | null>(null);
  // Kept in a ref because the render effect must not re-run when the document
  // object identity changes on re-render.
  const pdfDocRef = useRef<unknown>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageHeightPoints, setPageHeightPoints] = useState(0);
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState<AnnotationKind>("text");
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current as
      | { getPage: (n: number) => Promise<Record<string, unknown>> }
      | null;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const page = (await doc.getPage(pageIndex + 1)) as {
      getViewport: (o: { scale: number }) => { width: number; height: number };
      render: (o: Record<string, unknown>) => { promise: Promise<void> };
    };
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setPageHeightPoints(page.getViewport({ scale: 1 }).height);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
  }, [pageIndex, scale]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  async function openFile(file: File) {
    setBusy(true);
    setStatus(null);
    try {
      const bytes = await file.arrayBuffer();
      sourceBytesRef.current = bytes;

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      // pdf.js takes ownership of the buffer it is given, so hand it a copy and
      // keep the original intact for saving later.
      const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      pdfDocRef.current = doc;

      setFileName(file.name);
      setPageCount(doc.numPages);
      setPageIndex(0);
      setAnnotations([]);
      setActiveId(null);
    } catch {
      setStatus("That file could not be opened. Is it a valid PDF?");
    } finally {
      setBusy(false);
    }
  }

  function placeAnnotation(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !pageHeightPoints) return;

    const rect = canvas.getBoundingClientRect();
    const point = canvasPointToPdf(
      event.clientX - rect.left,
      event.clientY - rect.top,
      scale,
      pageHeightPoints,
    );
    const id = crypto.randomUUID();
    setAnnotations((prev) => [
      ...prev,
      {
        id,
        kind: tool,
        pageIndex,
        x: point.x,
        y: point.y,
        text: defaultTextFor(tool),
        fontSize: fontSizeFor(tool),
      },
    ]);
    setActiveId(id);
  }

  async function save() {
    if (!sourceBytesRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      const bytes = await flattenAnnotations(sourceBytesRef.current, annotations);
      downloadBytes(bytes, (fileName ?? "document").replace(/\.pdf$/i, "") + "-edited.pdf");
      setStatus("Saved. The edited copy has been downloaded.");
    } catch {
      setStatus("Could not save the edited PDF.");
    } finally {
      setBusy(false);
    }
  }

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);
  const active = annotations.find((a) => a.id === activeId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF Editor"
        description="Open a PDF, drop in text, dates, ticks and a signature, then save a flattened copy. Everything happens in the browser - the file is never uploaded."
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void openFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer shadow-none transition-colors duration-200"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FileUp className="size-3.5" aria-hidden />
              Open PDF
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void save()}
              disabled={busy || !fileName}
            >
              <Download className="size-3.5" aria-hidden />
              Save copy
            </Button>
          </div>
        }
      />

      {status ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}

      {!fileName ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No document open</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Open a PDF to add text, a date, tick marks or a signature, then save a
            flattened copy.
          </p>
          <Button
            className="mt-4 cursor-pointer transition-colors duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="size-3.5" aria-hidden />
            Open PDF
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-4 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                {TOOLS.map(({ kind, label, icon: Icon }) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={tool === kind ? "default" : "outline"}
                    className="cursor-pointer transition-colors duration-200"
                    onClick={() => setTool(kind)}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Zoom out"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() =>
                    setScale((s) => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(s) - 1)] ?? s)
                  }
                >
                  <ZoomOut className="size-3.5" aria-hidden />
                </Button>
                <span className="font-mono text-xs tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Zoom in"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() =>
                    setScale(
                      (s) =>
                        ZOOM_STEPS[
                          Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(s) + 1)
                        ] ?? s,
                    )
                  }
                >
                  <ZoomIn className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>

            <div className="erp-scroll overflow-auto rounded-xl border border-border/80 bg-muted/30 p-4">
              <div className="relative mx-auto w-fit">
                <canvas
                  ref={canvasRef}
                  onClick={placeAnnotation}
                  className="cursor-crosshair rounded-sm bg-white shadow-md"
                />
                {pageAnnotations.map((annotation) => {
                  const pos = pdfPointToCanvas(
                    annotation.x,
                    annotation.y,
                    scale,
                    pageHeightPoints,
                  );
                  return (
                    <button
                      key={annotation.id}
                      type="button"
                      onClick={() => setActiveId(annotation.id)}
                      style={{
                        left: pos.left,
                        top: pos.top - annotation.fontSize * scale,
                        fontSize: annotation.fontSize * scale,
                      }}
                      className={cn(
                        "absolute cursor-pointer rounded-sm px-1 leading-tight whitespace-pre transition-colors duration-150",
                        annotation.kind === "signature" && "italic",
                        annotation.id === activeId
                          ? "bg-primary/15 ring-1 ring-primary"
                          : "hover:bg-primary/10",
                        !annotation.text && "min-w-8 bg-primary/10",
                      )}
                    >
                      {annotation.text || "…"}
                    </button>
                  );
                })}
              </div>
            </div>

            {pageCount > 1 ? (
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-mono text-xs tabular-nums">
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </section>

          <aside className="space-y-3">
            <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Selected</h2>
                {active ? <Badge variant="secondary">{active.kind}</Badge> : null}
              </div>
              {active ? (
                <div className="mt-3 space-y-3">
                  <Input
                    value={active.text}
                    autoFocus
                    placeholder={
                      active.kind === "signature" ? "Type your name" : "Type here"
                    }
                    onChange={(e) =>
                      setAnnotations((prev) =>
                        prev.map((a) =>
                          a.id === active.id ? { ...a, text: e.target.value } : a,
                        ),
                      )
                    }
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full cursor-pointer transition-colors duration-200"
                    onClick={() => {
                      setAnnotations((prev) => prev.filter((a) => a.id !== active.id));
                      setActiveId(null);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick a tool, then click on the page to place it.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Additions ({annotations.length})
              </h2>
              {annotations.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {annotations.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPageIndex(a.pageIndex);
                          setActiveId(a.id);
                        }}
                        className={cn(
                          "w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-muted",
                          a.id === activeId && "bg-muted",
                        )}
                      >
                        <span className="font-medium capitalize">{a.kind}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · p{a.pageIndex + 1} · {a.text || "empty"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
