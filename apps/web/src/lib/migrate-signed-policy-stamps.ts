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
import { devError, devWarn } from "@/lib/dev-log";

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
        for (const c of cases) {
          const sigUrl = c.portal?.policies?.signatureDataUrl;
          if (!sigUrl || !sigUrl.startsWith("data:image/")) continue;
          const policies = listActivePoliciesForPortal(c.entityId);
          if (!policies.length) continue;
          try {
            const stamped = await stampPoliciesWithSignature({
              policies,
              signatureDataUrl: sigUrl,
              signatureMimeType: c.portal?.policies?.signatureMimeType,
              candidateName: c.candidateName,
            });
            await saveSignedPolicyDocsForCase(c.id, stamped);
          } catch (err) {
            devWarn(`Could not re-stamp policies for case ${c.id}`);
          }
        }

        await idbSetJson(FORMAT_KEY, SIGNED_POLICY_STAMP_FORMAT);
      } catch (err) {
        devWarn("Signed policy stamp migration failed");
        migratePromise = null;
      }
    })();
  }
  await migratePromise;
}
