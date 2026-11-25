# Store review fill-in (iConnect+)

Use with App Store Connect + Play Console. Package: `com.iconnectplusin.employeeportal`.

## Demo login (Review Notes)

```
demo@company.com
demo123
```

Mock ESS data — not connected to a live employer ERP. Employer-provisioned accounts in production.

Privacy: https://iconnectplus.in/legal/privacy  
Terms: https://iconnectplus.in/legal/terms  
Data deletion: https://iconnectplus.in/legal/data-deletion  
Support: https://iconnectplus.in/support · erp@iconnectplus.in

## Apple — Privacy Nutrition Labels (declare as collected)

| Data type | Linked to user? | Used for tracking? | Purpose |
|-----------|-----------------|--------------------|---------|
| Precise Location | Yes | No | App functionality (attendance punch) |
| Photos / Videos (user-selected) | Yes | No | App functionality (docs / selfie / profile) |
| Name, Email, Phone | Yes | No | App functionality (HR profile) |
| User ID / Employee ID | Yes | No | App functionality |
| Device ID (push token) | Yes | No | App functionality (notifications) |
| Product interaction / diagnostics | Yes | No | Analytics / App functionality (crash/support) |

Do **not** declare tracking / third-party advertising.

Privacy Policy URL: `https://iconnectplus.in/legal/privacy`  
Encryption: HTTPS only → export compliance **No** (ITSAppUsesNonExemptEncryption false).

## Google Play — Data safety (summary)

- Collects: approximate? **No** → precise location **Yes** (while using app / punch)
- Photos: user-selected via system picker (not broad gallery)
- Personal info: name, email, phone, employee identifiers
- App activity / device IDs: push tokens
- Shared with: employer / ERP processors (see privacy policy) — not sold
- Security: data encrypted in transit
- Deletion: https://iconnectplus.in/legal/data-deletion
- Account required: yes (employer-provisioned)

## Screenshots / assets

- iOS real UI: `docs/store-assets/ios-real/` (1206×2622)
- Header / search: `docs/store-assets/ios/`
- App icon 1024: `docs/store-assets/ios-real/app-icon-1024.png`
- Play feature graphic 1024×500: `docs/store-assets/play/feature-graphic-1024x500.png`

## ASC submit (after TestFlight QA)

1. Version 1.0 → select processed build  
2. Privacy labels filled  
3. Screenshots uploaded  
4. Export compliance answered  
5. **Add for Review**

## Next binary notes

- `ios.supportsTablet` set to **false** so iPad screenshots are not required (ships on next iOS build).  
- Current TestFlight build 7 may still declare tablet support until you ship a new IPA.  
