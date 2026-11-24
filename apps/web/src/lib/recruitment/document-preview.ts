/** Convert a data: URL into a short-lived blob: URL for reliable PDF preview. */
export function dataUrlToBlobUrl(dataUrl: string): string | null {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) return null;
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const header = trimmed.slice(5, comma);
  const payload = trimmed.slice(comma + 1);
  if (!payload) return null;

  const mime = (header.split(";")[0] || "application/octet-stream").trim() || "application/octet-stream";
  const isBase64 = /;base64/i.test(header);

  try {
    let bytes: Uint8Array;
    if (isBase64) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      const decoded = decodeURIComponent(payload);
      bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    }
    // Ensure PDF MIME is clean — jsPDF may emit `application/pdf;filename=…`
    const blobType = mime.toLowerCase().includes("pdf") ? "application/pdf" : mime;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return URL.createObjectURL(new Blob([copy], { type: blobType }));
  } catch {
    return null;
  }
}

/** Prefer blob: for data: PDFs so Chrome/Edge PDF viewer can render in embed/iframe. */
export function resolvePreviewSrc(href: string | null | undefined): {
  src: string | null;
  revoke?: () => void;
} {
  const raw = (href || "").trim();
  if (!raw) return { src: null };
  if (raw.startsWith("blob:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return { src: raw };
  }
  if (raw.startsWith("data:")) {
    const blobUrl = dataUrlToBlobUrl(raw);
    if (!blobUrl) return { src: null };
    return {
      src: blobUrl,
      revoke: () => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          /* ignore */
        }
      },
    };
  }
  return { src: raw };
}

export function isPdfHref(opts: {
  fileName?: string;
  mimeType?: string;
  href?: string | null;
}): boolean {
  if ((opts.mimeType || "").toLowerCase().includes("pdf")) return true;
  if (/\.pdf$/i.test(opts.fileName || "")) return true;
  const href = (opts.href || "").toLowerCase();
  return href.includes("application/pdf") || href.startsWith("blob:");
}
