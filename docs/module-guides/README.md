# Module User Guides — Quality, Helpdesk, Analytics

Plain-language documentation for developers and business users taking over work started by another team member.

## Start here

| Guide | Module | App URL |
|-------|--------|---------|
| [01 — Quality Management](01-Quality-Management-Guide.md) | FRD-14 | http://localhost:3000/quality |
| [04 — Quality presentation walkthrough](04-Quality-Presentation-Walkthrough.md) | Live demo script (DEMO-HMC) | http://localhost:3000/quality |
| [02 — Helpdesk & Support](02-Helpdesk-Guide.md) | FRD-17 | http://localhost:3000/helpdesk |
| [03 — Analytics & BI](03-Analytics-BI-Guide.md) | FRD-18 | http://localhost:3000/analytics |

## What each guide contains

1. **What the module does** (simple explanation)
2. **How it connects** to other ERP modules
3. **End-to-end workflow** (step-by-step story)
4. **Terminology dictionary** (jargon translated)
5. **Screen-by-screen menu guide**
6. **What is already built vs pending**
7. **How to work with it** (user + developer paths)
8. **Alignment with KRI Excel** (`Module-KRI-Tracker.xlsx`)

## Related files

| File | Purpose |
|------|---------|
| `Module-KRI-Tracker.xlsx` | Manager KRI / completion tracking |
| `docs/02_FRD/FRD-14-*.md` | Official quality requirements |
| `docs/02_FRD/FRD-17-*.md` | Official helpdesk requirements |
| `docs/02_FRD/FRD-18-*.md` | Official analytics requirements |
| `scripts/generate_kri_tracker.py` | Regenerate Excel after progress updates |

## Suggested reading order

1. Read this README.
2. Pick the module you are working on.
3. Skim **Section 3 (workflow)** and **Section 4 (terminology)** first.
4. Open the app URL and follow **Section 7 (how to work with it)** hands-on.
5. Use **Section 6** to know what the previous developer finished vs what you still need to build.

## Demo access

- **App:** http://localhost:3000  
- **API docs:** http://localhost:8000/docs (development only)  
- **Login:** use accounts seeded by `seed_demo_data` with the `DEMO_PASSWORD` from your local `.env` (never committed; never shown in the UI).
