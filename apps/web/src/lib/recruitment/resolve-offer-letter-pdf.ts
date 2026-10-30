/**
 * Resolve the full offer letter PDF (letterhead + stamped body), not a plain text stub.
 */

import { composeOfferLetterPdf } from "@/lib/recruitment/compose-offer-letter-pdf";
import { getDocumentContent } from "@/lib/recruitment/document-content-store";
import { buildOfferLetterPdfDataUrl } from "@/lib/recruitment/offer-letter-pdf";
import {
  getOfferLetterPdf,
  isSubstantialPdfDataUrl,
  saveOfferLetterPdf,
} from "@/lib/recruitment/offer-letter-pdf-store";
import { ensureOfferLetterTemplatesLoaded } from "@/services/offer-letter-templates-service";
import type { AtsDocument, AtsOffer, OfferLetterTemplate } from "@/types/recruitment-ats";

function pickTemplate(
  offer: AtsOffer,
  templates: OfferLetterTemplate[],
): OfferLetterTemplate | null {
  if (!templates.length) return null;
  const byFile =
    templates.find(
      (t) =>
        t.pdfFileName === offer.offerLetterName ||
        t.pdfFileName === offer.templateFileName ||
        t.name === offer.offerLetterName,
    ) || null;
  return byFile || templates[0] || null;
}

/**
 * Return a data:application/pdf URL for the offer letter as generated with the template.
 */
export async function resolveOfferLetterPdfDataUrl(
  offer: AtsOffer,
  doc?: AtsDocument | null,
): Promise<string | null> {
  const body = (offer.mergedPreview || "").trim();
  const fromDoc = (doc?.contentDataUrl || doc?.url || "").trim();

  // 1) IndexedDB composed PDF (letterhead + body) — preferred
  const fromStore = await getOfferLetterPdf(offer.id);
  if (fromStore?.startsWith("data:")) return fromStore;

  // 1b) Document content store (large PDFs stripped from localStorage)
  if (doc?.id) {
    const fromDocStore = await getDocumentContent(doc.id);
    if (isSubstantialPdfDataUrl(fromDocStore)) {
      await saveOfferLetterPdf(offer.id, fromDocStore);
      return fromDocStore;
    }
  }

  // 2) Re-compose from letterhead template + saved body (same as generate)
  const templates = await ensureOfferLetterTemplatesLoaded();
  const tpl = pickTemplate(offer, templates);
  if (tpl?.pdfDataUrl?.startsWith("data:") && body) {
    try {
      const composed = await composeOfferLetterPdf({
        letterheadDataUrl: tpl.pdfDataUrl,
        body,
      });
      if (composed.startsWith("data:")) {
        await saveOfferLetterPdf(offer.id, composed);
        return composed;
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Document row if it already holds a real composed PDF
  if (isSubstantialPdfDataUrl(fromDoc)) {
    await saveOfferLetterPdf(offer.id, fromDoc);
    return fromDoc;
  }

  // 4) Last resort: plain body PDF (no letterhead template available)
  if (body) {
    return buildOfferLetterPdfDataUrl({
      offerCode: offer.offerCode,
      body,
    });
  }
  return fromDoc || null;
}
