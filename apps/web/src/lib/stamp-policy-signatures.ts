/**
 * Stamp a signature image onto every page of policy PDFs (bottom-right).
 * Used when a candidate submits onboarding.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import type { PortalPolicyDoc } from "@/services/onboarding-policies-service";

export const MAX_SIGNATURE_BYTES = 100 * 1024; // 100 KB

export type SignedPolicyDocument = {
  policyId: string;
  title: string;
  fileName: string;
  fileDataUrl: string;
  mimeType: string;
  signedAt: string;
};

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToPdfDataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

function isPng(dataUrl: string, mime?: string): boolean {
  return (mime || "").includes("png") || dataUrl.startsWith("data:image/png");
}

function isJpeg(dataUrl: string, mime?: string): boolean {
  return (
    (mime || "").includes("jpeg") ||
    (mime || "").includes("jpg") ||
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  );
}

async function embedSignatureImage(
  pdfDoc: PDFDocument,
  signatureDataUrl: string,
  mimeType?: string,
) {
  const bytes = dataUrlToUint8Array(signatureDataUrl);
  if (isPng(signatureDataUrl, mimeType)) {
    return pdfDoc.embedPng(bytes);
  }
  if (isJpeg(signatureDataUrl, mimeType)) {
    return pdfDoc.embedJpg(bytes);
  }
  // Try PNG then JPG
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return pdfDoc.embedJpg(bytes);
  }
}

async function createTextPolicyPdf(title: string, body: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;
  const paragraphs = (body || "No written policy content.").split(/\n/);
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(title || "Policy", {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    const flush = (text: string) => {
      if (y < margin + 80) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(text, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15),
        maxWidth,
      });
      y -= lineHeight;
    };
    if (!words.length) {
      y -= lineHeight / 2;
      continue;
    }
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) > maxWidth && line) {
        flush(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) flush(line);
  }

  return doc;
}

function stampSignatureOnPages(
  pdfDoc: PDFDocument,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sigImage: any,
) {
  const pages = pdfDoc.getPages();
  const maxW = 120;
  const maxH = 48;
  const margin = 36;

  for (const page of pages) {
    const { width } = page.getSize();
    const dims = sigImage.scale(1);
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    const w = dims.width * scale;
    const h = dims.height * scale;
    const x = width - margin - w;
    const y = margin;
    page.drawImage(sigImage, { x, y, width: w, height: h });
  }
}

/**
 * Build signed PDF copies of every active policy, with the candidate signature
 * stamped on the bottom-right of each page.
 */
export async function stampPoliciesWithSignature(input: {
  policies: PortalPolicyDoc[];
  signatureDataUrl: string;
  signatureMimeType?: string;
  candidateName?: string;
}): Promise<SignedPolicyDocument[]> {
  const { policies, signatureDataUrl, signatureMimeType } = input;
  const signedAt = new Date().toISOString();
  const out: SignedPolicyDocument[] = [];

  for (const policy of policies) {
    let pdfDoc: PDFDocument;
    if (policy.fileDataUrl && (policy.mimeType || "").includes("pdf")) {
      const bytes = dataUrlToUint8Array(policy.fileDataUrl);
      pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } else if (policy.fileDataUrl && (policy.mimeType || "").startsWith("image/")) {
      // Image policy → wrap into a single-page PDF then stamp
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const imgBytes = dataUrlToUint8Array(policy.fileDataUrl);
      const img = isPng(policy.fileDataUrl, policy.mimeType)
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);
      const maxW = 500;
      const maxH = 700;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: (595.28 - w) / 2,
        y: 841.89 - 60 - h,
        width: w,
        height: h,
      });
      page.drawText(policy.label, {
        x: 48,
        y: 810,
        size: 14,
        color: rgb(0.1, 0.1, 0.1),
      });
    } else {
      pdfDoc = await createTextPolicyPdf(policy.label, policy.body);
    }

    const sigImage = await embedSignatureImage(pdfDoc, signatureDataUrl, signatureMimeType);
    stampSignatureOnPages(pdfDoc, sigImage);

    const pdfBytes = await pdfDoc.save();
    const safeTitle = (policy.label || "policy").replace(/[^\w\-]+/g, "_").slice(0, 40);
    out.push({
      policyId: policy.id,
      title: policy.label,
      fileName: `${safeTitle}_signed.pdf`,
      fileDataUrl: uint8ArrayToPdfDataUrl(pdfBytes),
      mimeType: "application/pdf",
      signedAt,
    });
  }

  return out;
}
