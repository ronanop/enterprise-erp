import type { DcChallanDocument, DcChallanRow, DcChallanUploadLimits } from "@/services/assets-service";

export const DC_CHALLAN_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DC_CHALLAN_ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DC_CHALLAN_ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];

export type DcDocumentKind = "scm-issued" | "signed";

const FALLBACK_LIMITS: DcChallanUploadLimits = {
  max_upload_mb: 10,
  allowed_content_types: ["application/pdf", "image/jpeg", "image/png"],
};

export function resolveUploadLimits(limits?: DcChallanUploadLimits | null): DcChallanUploadLimits {
  const maxMb = limits?.max_upload_mb && limits.max_upload_mb > 0 ? limits.max_upload_mb : FALLBACK_LIMITS.max_upload_mb;
  const types = limits?.allowed_content_types?.length
    ? limits.allowed_content_types
    : FALLBACK_LIMITS.allowed_content_types;
  return { max_upload_mb: maxMb, allowed_content_types: types };
}

export function validateDcChallanFile(file: File, limits?: DcChallanUploadLimits | null): string | null {
  const resolved = resolveUploadLimits(limits);
  const maxBytes = resolved.max_upload_mb * 1024 * 1024;
  const allowed = new Set(resolved.allowed_content_types.map((t) => t.toLowerCase()));
  allowed.add("image/jpg");
  if (file.size > maxBytes) {
    return `File is larger than the ${resolved.max_upload_mb} MB upload limit. Only PDF, JPEG, and PNG files are allowed.`;
  }
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const extOk = DC_CHALLAN_ALLOWED_EXT.some((ext) => name.endsWith(ext));
  const mimeOk = !mime || allowed.has(mime);
  if (!extOk && !mimeOk) {
    return `Only PDF, JPEG, and PNG files are allowed, up to ${resolved.max_upload_mb} MB.`;
  }
  if (mime && !mimeOk) {
    return `Only PDF, JPEG, and PNG files are allowed, up to ${resolved.max_upload_mb} MB.`;
  }
  return null;
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadedAt(value?: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function documentSourceLabel(source?: string | null): string {
  if (source === "SCM_CALLBACK") return "From SCM";
  if (source === "MANUAL_UPLOAD") return "Uploaded manually";
  if (!source) return "Legacy URL";
  return source;
}

export function uploadedByLabel(doc: DcChallanDocument): string {
  const when = formatUploadedAt(doc.uploaded_at);
  if (doc.source === "SCM_CALLBACK") return `Uploaded by SCM platform · ${when}`;
  if (doc.source === "MANUAL_UPLOAD") return `Uploaded by Manual upload · ${when}`;
  if (doc.is_legacy) return `Uploaded by Legacy URL · ${when}`;
  return when === "—" ? "—" : `Uploaded · ${when}`;
}

export function previewKindFromDocument(doc: DcChallanDocument | null | undefined): "pdf" | "image" | "other" {
  const type = (doc?.content_type || "").toLowerCase();
  const name = (doc?.original_filename || doc?.external_url || "").toLowerCase();
  if (type === "application/pdf" || name.includes(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g)(\?|$)/.test(name)) return "image";
  return "other";
}

export function resolveScmIssuedDocument(row: DcChallanRow): DcChallanDocument | null {
  if (row.scm_issued_document) return row.scm_issued_document;
  if (row.scm_document_url) {
    return {
      doc_kind: "SCM_ISSUED",
      external_url: row.scm_document_url,
      uploaded_at: row.scm_document_uploaded_at,
      is_legacy: true,
      has_stored_file: false,
    };
  }
  return null;
}

export function resolveSignedDocument(row: DcChallanRow): DcChallanDocument | null {
  if (row.signed_document) return row.signed_document;
  if (row.signed_document_url) {
    return {
      doc_kind: "SIGNED",
      external_url: row.signed_document_url,
      uploaded_at: row.signed_document_uploaded_at,
      is_legacy: true,
      has_stored_file: false,
    };
  }
  return null;
}

export function pickLinkedDcChallan(items: DcChallanRow[]): DcChallanRow | null {
  if (!items.length) return null;
  const open = items.find((row) =>
    ["PENDING", "SENT_TO_SCM", "DOCUMENT_RECEIVED", "SIGNED"].includes(row.status),
  );
  if (open) return open;
  const received = items.find((row) => row.status === "RECEIVED");
  return received ?? items[0] ?? null;
}

export async function printBlobUrl(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.src = url;
    const cleanup = () => {
      window.setTimeout(() => {
        frame.remove();
      }, 1000);
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    frame.onerror = () => {
      cleanup();
      reject(new Error("Could not load document for print"));
    };
    document.body.appendChild(frame);
  });
}
