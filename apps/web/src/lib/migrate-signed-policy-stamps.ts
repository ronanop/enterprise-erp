/**
 * Re-stamp signed policy PDFs when stamp format changes
 * (e.g. remove legacy "Digitally signed" label from stored copies).
 */

import { idbGetJson, idbSetJson } from "@/lib/client-idb-json-store";
import {
  ensureOnboardingPoliciesLoaded,
  listActivePoliciesForPortal,
} from "@/services/onboarding-policies-service";
import { stampPoliciesWithSignature } from "@/lib/stamp-policy-signatures";
import { saveSignedPolicyDocsForCase } from "@/lib/onboarding-signed-docs-store";
import type { OnboardingCase } from "@/types/onboarding-management";

/** Bump when stamp appearance changes so old IDB PDFs are regenerated. */
export const SIGNED_POLICY_STAMP_FORMAT = 2;
const FORMAT_KEY = "erp_onboarding_signed_stamp_format_v1";

let migratePromise: Promise<void> | null = null;

/**
 * Re-generate signed policy PDFs for every case that has a signature image,
 * using the current stamp rules (signature image only — no label text).
 */
export async function migrateSignedPolicyStampFormat(
  cases: OnboardingCase[],
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!migratePromise) {
    migratePromise = (async () => {
      try {
        const current = await idbGetJson<number>(FORMAT_KEY);
        if (current === SIGNED_POLICY_STAMP_FORMAT) return;

        await ensureOnboardingPoliciesLoaded();
        const policies = listActivePoliciesForPortal();
        if (!policies.length) {
          await idbSetJson(FORMAT_KEY, SIGNED_POLICY_STAMP_FORMAT);
          return;
        }

        for (const c of cases) {
          const sigUrl = c.portal?.policies?.signatureDataUrl;
          if (!sigUrl || !sigUrl.startsWith("data:image/")) continue;
          try {
            const stamped = await stampPoliciesWithSignature({
              policies,
              signatureDataUrl: sigUrl,
              signatureMimeType: c.portal?.policies?.signatureMimeType,
              candidateName: c.candidateName,
            });
            await saveSignedPolicyDocsForCase(c.id, stamped);
          } catch (err) {
            console.warn(`Could not re-stamp policies for case ${c.id}`, err);
          }
        }

        await idbSetJson(FORMAT_KEY, SIGNED_POLICY_STAMP_FORMAT);
      } catch (err) {
        console.warn("Signed policy stamp migration failed", err);
        migratePromise = null;
      }
    })();
  }
  await migratePromise;
}
