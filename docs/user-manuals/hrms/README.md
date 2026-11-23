# HRMS Module User Manual

Hire-to-exit walkthrough (Recruitment → Onboarding → Employees → Attendance → Performance → Payroll → Offboarding), plus Org Setup / Leave Setup and all primary sidebar panes.

## Start here (how-to)

| File | Description |
|------|-------------|
| [`HRMS-How-To-Manual.md`](./HRMS-How-To-Manual.md) | Step-by-step: Dashboard, Recruitment, Onboarding, Workforce (no Performance), Payroll through Payslip, EDoc, Org Setup, IT & Admin, Offboarding |

## Outputs

| File | Description |
|------|-------------|
| `hrms-user-manual.html` | Print-ready HTML (ERP theme) |
| `HRMS-Module-User-Manual.pdf` | PDF printed via headless Chrome |
| `assets/screenshots/process/` | Steps 01–13 |
| `assets/screenshots/sidebar/` | 17 primary panes |

## Demo profile

- **Employee:** Moksh Sharma (`CT5345`)
- **Designation:** Junior AI Developer · Technical · Cache Digitech
- **IDs:** see `assets/demo-ids.txt`

## Rebuild

```powershell
python docs/user-manuals/hrms/_build_hrms_manual.py
```

Print PDF (prefer `C:\Temp` if OneDrive yields a tiny file):

```powershell
$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$pdfTemp = "C:\Temp\HRMS-Module-User-Manual.pdf"
# serve HTML via python -m http.server, then:
& $chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdfTemp" "http://127.0.0.1:8880/hrms-user-manual.html"
Copy-Item $pdfTemp "docs\user-manuals\hrms\HRMS-Module-User-Manual.pdf" -Force
```

## Audience

HR admins and assigned members. Sign in with Microsoft Entra SSO.
