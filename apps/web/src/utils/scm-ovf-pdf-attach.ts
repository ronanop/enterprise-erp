import {
  getScmOvfPreview,
  listScmOvfAttachments,
  uploadScmOvfAttachment,
  type ScmCommercialAttachment,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import { buildScmOvfPdfBlob } from "@/utils/scm-ovf-pdf";

export function isScmOvfPdfAttachment(row: {
  category?: string | null;
  file_name?: string | null;
  fileName?: string | null;
}): boolean {
  const category = (row.category || "").toLowerCase();
  const name = (row.file_name || row.fileName || "").toLowerCase();
  return (
    category === "ovf_pdf" ||
    (name.startsWith("ovf-") && name.endsWith(".pdf")) ||
    (name.includes("ovf") && name.endsWith(".pdf"))
  );
}

/**
 * Ensure the same OVF PDF as View OVF → Download PDF is stored on the OVF
 * commercial documents pack (used by Approval inbox).
 */
export async function ensureScmOvfPdfAttached(ovfId: string): Promise<ScmCommercialAttachment | null> {
  const id = String(ovfId || "").trim();
  if (!id) return null;

  const existing = await listScmOvfAttachments(id).catch(() => [] as ScmCommercialAttachment[]);
  const already = existing.find((row) => isScmOvfPdfAttachment(row));
  if (already) return already;

  const preview = await getScmOvfPreview(id);
  if (!preview?.branch_id) return null;

  const { blob, fileName } = await buildScmOvfPdfBlob(preview);
  const file = new File([blob], fileName, { type: "application/pdf" });
  const content_base64 = await fileToBase64(file);
  return uploadScmOvfAttachment(id, {
    file_name: fileName,
    content_base64,
    content_type: "application/pdf",
    branch_id: preview.branch_id,
    company_id: preview.company_id || null,
    category: "ovf_pdf",
    remarks: "Auto-generated OVF PDF",
  });
}
