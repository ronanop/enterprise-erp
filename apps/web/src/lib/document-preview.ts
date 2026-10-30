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

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const trimmed = dataUrl.trim();
  const comma = trimmed.indexOf(",");
  const header = comma >= 0 ? trimmed.slice(0, comma) : "";
  const payload = comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  if (!payload) throw new Error("Empty data URL");

  if (/;base64/i.test(header) || (!header.includes("data:") && /^[A-Za-z0-9+/=\s]+$/.test(payload))) {
    const binary = atob(payload.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const bytes = dataUrlToUint8Array(dataUrl);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function dataUrlToBlob(dataUrl: string, mimeFallback = "application/octet-stream"): Blob {
  const match = /^data:([^;,]+)?/i.exec(dataUrl.trim());
  let mime = (match?.[1] || mimeFallback).trim() || mimeFallback;
  // Chrome PDF viewer breaks on `application/pdf;filename=…` — keep MIME clean
  if (/pdf/i.test(mime) || /pdf/i.test(mimeFallback)) mime = "application/pdf";
  const bytes = dataUrlToUint8Array(dataUrl);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

/** True when data URL looks like a non-empty PDF payload. */
export function isUsablePdfDataUrl(dataUrl: string | null | undefined): boolean {
  if (!dataUrl || !dataUrl.trim().startsWith("data:")) return false;
  try {
    const bytes = dataUrlToUint8Array(dataUrl);
    if (bytes.byteLength < 5) return false;
    // %PDF-
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    );
  } catch {
    return false;
  }
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
