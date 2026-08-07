import type { OnboardingDocument } from "@/types/onboarding-management";

export function documentMimeType(doc: OnboardingDocument): string {
  if (doc.mimeType) return doc.mimeType;
  const name = doc.fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function canPreviewOnboardingDocument(doc: OnboardingDocument): boolean {
  if (!doc.fileDataUrl) return false;
  const mime = documentMimeType(doc);
  return mime.startsWith("image/") || mime === "application/pdf";
}

export function downloadOnboardingDocument(doc: OnboardingDocument): boolean {
  if (!doc.fileDataUrl) return false;
  const a = document.createElement("a");
  a.href = doc.fileDataUrl;
  a.download = doc.fileName || "document";
  a.rel = "noopener";
  a.click();
  return true;
}
