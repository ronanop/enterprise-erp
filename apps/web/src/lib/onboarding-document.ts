import type { OnboardingDocument } from "@/types/onboarding-management";
import {
  canPreviewDocument,
  resolveDocumentMime,
  triggerDataUrlDownload,
} from "@/lib/document-preview";

export function documentMimeType(doc: OnboardingDocument): string {
  return resolveDocumentMime(doc.fileName, doc.mimeType);
}

export function canPreviewOnboardingDocument(doc: OnboardingDocument): boolean {
  return canPreviewDocument(doc.fileName, doc.mimeType, doc.fileDataUrl);
}

export function downloadOnboardingDocument(doc: OnboardingDocument): boolean {
  if (!doc.fileDataUrl) return false;
  triggerDataUrlDownload(doc.fileDataUrl, doc.fileName || "document");
  return true;
}
