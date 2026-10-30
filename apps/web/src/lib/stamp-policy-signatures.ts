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

function formatSignedAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // e.g. 30 Oct 2026, 14:12:05
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function stampSignatureOnPages(
  pdfDoc: PDFDocument,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sigImage: any,
  signedAtIso: string,
  candidateName?: string,
) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const maxW = 140;
  const maxH = 52;
  const margin = 36;
  const dateLabel = formatSignedAtLabel(signedAtIso);
  const nameLine = (candidateName || "").trim();
  const dateLine = `Signed: ${dateLabel}`;
  const fontSize = 8;
  const lineGap = 10;

  for (const page of pages) {
    const { width } = page.getSize();
    const dims = sigImage.scale(1);
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    const w = dims.width * scale;
    const h = dims.height * scale;

    // Stack from bottom-right: date (and optional name) under the signature image
    let cursorY = margin;
    const dateWidth = font.widthOfTextAtSize(dateLine, fontSize);
    page.drawText(dateLine, {
      x: width - margin - dateWidth,
      y: cursorY,
      size: fontSize,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    cursorY += lineGap;

    if (nameLine) {
      const nameWidth = bold.widthOfTextAtSize(nameLine, fontSize);
      page.drawText(nameLine, {
        x: width - margin - nameWidth,
        y: cursorY,
        size: fontSize,
        font: bold,
        color: rgb(0.15, 0.15, 0.15),
      });
      cursorY += lineGap;
    }

    const x = width - margin - w;
    const y = cursorY + 2;
    page.drawImage(sigImage, { x, y, width: w, height: h });
  }
}

/**
 * Build signed PDF copies of every active policy, with the candidate signature
 * stamped on the bottom-right of each page (with date and time).
 */
export async function stampPoliciesWithSignature(input: {
  policies: PortalPolicyDoc[];
  signatureDataUrl: string;
  signatureMimeType?: string;
  candidateName?: string;
  /** ISO timestamp shown under the signature; defaults to now. */
  signedAt?: string;
}): Promise<SignedPolicyDocument[]> {
  const { policies, signatureDataUrl, signatureMimeType, candidateName } = input;
  const signedAt = input.signedAt || new Date().toISOString();
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
    await stampSignatureOnPages(pdfDoc, sigImage, signedAt, candidateName);

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
