/** Client-side attachment open/download helpers that avoid XSS via blob HTML/SVG. */

const INLINE_SAFE_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
]);

const BLOCKED_UPLOAD_EXT = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".js",
  ".mjs",
  ".xml",
  ".xsl",
  ".php",
  ".asp",
  ".aspx",
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
]);

export function fileExtension(name: string): string {
  const base = (name || "").split(/[/\\]/).pop() || "";
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx).toLowerCase() : "";
}

export function isInlineSafeAttachment(fileName: string, contentType?: string | null): boolean {
  const ext = fileExtension(fileName);
  if (!INLINE_SAFE_EXT.has(ext)) return false;
  const media = (contentType || "").split(";")[0].trim().toLowerCase();
  if (
    media === "text/html" ||
    media === "image/svg+xml" ||
    media === "application/xhtml+xml" ||
    media === "text/javascript" ||
    media === "application/javascript"
  ) {
    return false;
  }
  return true;
}

export function assertSafeUploadFile(file: File): void {
  const ext = fileExtension(file.name);
  if (!ext || BLOCKED_UPLOAD_EXT.has(ext)) {
    throw new Error(
      `File type '${ext || "unknown"}' is not allowed. Upload PDF, Office, or image documents only.`,
    );
  }
  const media = (file.type || "").split(";")[0].trim().toLowerCase();
  if (
    media === "text/html" ||
    media === "image/svg+xml" ||
    media === "application/xhtml+xml" ||
    media === "text/javascript"
  ) {
    throw new Error("Active web content cannot be uploaded.");
  }
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
