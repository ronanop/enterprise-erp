# Asset Management User Manual

Intake-to-disposal walkthrough (Incoming → QC → Registration → Inventory → Assignment → DC / Transfers / Maintenance → Disposal), plus Components, Documents, Reports, Users, and Non-IT domain.

## Outputs

| File | Description |
|------|-------------|
| `assets-training-manual.html` | Classroom / onboarding training guide |
| `Assets-Module-Training-Manual.pdf` | Training PDF (print via headless Chrome) |
| `assets-user-manual.html` | Full module reference HTML (ERP theme) |
| `Assets-Module-User-Manual.pdf` | Full reference PDF printed via headless Chrome |
| `assets/screenshots/process/` | Steps 01–15 |
| `assets/screenshots/sidebar/` | 19 primary panes |

## Demo profile

- **Asset:** CT-HP-Aman (`AST-2026-000003`)
- **Make / Model:** HP · HP ELITEBOOK 840 G7
- **Assignee:** Aman Raj (`CT5319`) · New Delhi - CRC2
- **Assignment:** `AASN-2026-000002`
- **IDs:** see `assets/demo-ids.txt`

## Rebuild

```powershell
python docs/user-manuals/assets/_build_assets_manual.py
```

Print PDFs (prefer `C:\Temp` if OneDrive yields a tiny file):

```powershell
$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$dir = (Resolve-Path "docs\user-manuals\assets").Path

# Training manual (classroom)
$pdfTemp = "C:\Temp\Assets-Module-Training-Manual.pdf"
$html = "$dir\assets-training-manual.html"
& $chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdfTemp" ([Uri]$html).AbsoluteUri
Copy-Item $pdfTemp "$dir\Assets-Module-Training-Manual.pdf" -Force

# Full reference manual
$pdfTemp = "C:\Temp\Assets-Module-User-Manual.pdf"
# serve HTML via python -m http.server, then:
& $chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdfTemp" "http://127.0.0.1:8880/assets-user-manual.html"
Copy-Item $pdfTemp "$dir\Assets-Module-User-Manual.pdf" -Force
```

## Audience

Asset admins and assigned IT / Non-IT domain members. Sign in with Microsoft Entra SSO.
