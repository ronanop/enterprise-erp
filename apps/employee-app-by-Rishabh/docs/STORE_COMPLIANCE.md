# App Store & Play Store compliance — Employee ESS

Use this when submitting `apps/employee-app-by-Rishabh` to Apple App Store and Google Play.

## What reviewers / consoles check

### Both stores
| Topic | What they expect | Our app |
|--------|------------------|---------|
| Privacy Policy | URL in listing **and** in-app | Login + Profile → Privacy Policy; set `EXPO_PUBLIC_PRIVACY_POLICY_URL` |
| Clear permission purpose | OS strings say *why* | `app.json` Info.plist / plugin strings |
| Data minimization | Only permissions needed for core features | Foreground precise GPS (punch), camera (selfie/scan), notifications; **no** broad gallery (`READ_MEDIA_*` removed) |
| Account / data deletion | In-app path + web URL if accounts exist | Profile → Request account / data deletion + `EXPO_PUBLIC_DATA_DELETION_URL` |
| Honest listing | Don’t claim live payroll if demo | Demo mode banner when `EXPO_PUBLIC_USE_MOCK=true` |
| Review login | Working demo credentials in Review Notes | See [STORE_REVIEW_STAGING.md](./STORE_REVIEW_STAGING.md) (`review.employee@…` / `Review@2026`) |

### Apple (App Review Guidelines)
- **5.1.1** Privacy policy, consent, purpose strings, deletion  
- **2.1** App completeness — live ESS API, working demo login, Review Notes + physical-device screen recording (see [ASC_REVIEW_NOTES_2_1.md](./ASC_REVIEW_NOTES_2_1.md))  
- **1.2 / UGC** — Feed post menu: Report, Block author, Complain  
- **5.1.5** Location only when relevant — we request/use GPS at attendance punch (and after rationale screen)  
- **Encryption** — `ITSAppUsesNonExemptEncryption: false` (HTTPS only)  
- **Privacy Nutrition Labels** in App Store Connect — declare location, photos, contact info, identifiers as collected from the app/API  
- **Privacy Manifest** — configured under `ios.privacyManifests` for required-reason APIs  
- **No IAP** — employer-licensed B2B ESS; no paid unlocks in-app

### Google Play
- **Data safety** form — location (precise), photos (user-selected via picker), personal info, device IDs / push tokens  
- **Photo/Video permissions** — do **not** declare `READ_MEDIA_IMAGES` for infrequent uploads; use system picker (we do)  
- **Location** — foreground / while-in-use only (no background location)  
- **Account deletion** — in-app + web link in Play Console  
- **Notifications** — `POST_NOTIFICATIONS` on Android 13+  

## Console checklist (before submit)

1. Host real pages for Privacy, Terms, Data deletion (replace default `iconnectplus.in/legal/...` URLs).  
2. App Store Connect → Privacy labels match actual collection.  
3. Play Console → Data safety + Data deletion URL.  
4. Review Notes: demo accounts + “employer-provisioned accounts; deletion is a request to HR”.  
5. Screenshots show ESS features, not empty shells.  
6. Production signing / bundle id `com.iconnectplusin.employeeportal` stable forever.  

## In-app surfaces added for compliance
- `/permissions` — rationale before OS prompts  
- `/privacy`, `/terms`, `/data-deletion`  
- Demo mode banner  
- Login legal links  

## Still your responsibility (legal / ops)
- Publish accurate privacy policy text (HRMS + ERP processors, retention).  
- Respond to deletion requests within your policy SLA.  
- When live: delete eligible personal data on request; disclose legal retention of employment records.  
