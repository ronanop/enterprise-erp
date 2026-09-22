/** Shared helpers for in-browser document preview (onboarding, eDoc, etc.). */

export type DocumentPreviewKind =
  | "image"
  | "pdf"
  | "docx"
  | "text"
  | "spreadsheet"
  | "unsupported";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const DOC_MIME = "application/msword";

export function inferMimeFromFileName(fileName: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".bmp")) return "image/bmp";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".docx")) return DOCX_MIME;
  if (name.endsWith(".doc")) return DOC_MIME;
  if (name.endsWith(".xlsx")) return XLSX_MIME;
  if (name.endsWith(".xls")) return XLS_MIME;
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
  return "application/octet-stream";
}

export function resolveDocumentMime(fileName: string, mimeType?: string | null): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return inferMimeFromFileName(fileName);
}

export function classifyDocumentPreview(
  fileName: string,
  mimeType?: string | null,
): DocumentPreviewKind {
  const mime = resolveDocumentMime(fileName, mimeType).toLowerCase();
  const name = fileName.toLowerCase();

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime === DOCX_MIME || name.endsWith(".docx")) return "docx";
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    /\.(txt|csv|md|json|html?|log)$/i.test(name)
  ) {
    return "text";
  }
  if (mime === XLSX_MIME || mime === XLS_MIME || /\.(xlsx|xls)$/i.test(name)) {
    return "spreadsheet";
  }
  return "unsupported";
}

export function canPreviewDocument(fileName: string, mimeType?: string | null, dataUrl?: string | null): boolean {
  if (!dataUrl) return false;
  return classifyDocumentPreview(fileName, mimeType) !== "unsupported";
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function dataUrlToBlob(dataUrl: string, mimeFallback = "application/octet-stream"): Blob {
  const match = /^data:([^;,]+)?/.exec(dataUrl);
  const mime = match?.[1] || mimeFallback;
  return new Blob([dataUrlToArrayBuffer(dataUrl)], { type: mime });
}

export function dataUrlToText(dataUrl: string): string {
  try {
    const comma = dataUrl.indexOf(",");
    const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
    const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    if (meta.includes(";base64")) {
      const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    return "";
  }
}

export function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName || "document";
  a.rel = "noopener";
  a.click();
}
