# Connect Plus Landing — FROZEN

This directory is the **canonical hardcoded public homepage**.

- Served at /site/connect-plus-landing/index.html
- Wired from pps/web/src/app/page.tsx
- Framer hydrate / main bundle **disabled** on purpose
- Custom ICP scripts (Lenis, slider, capsule, brand) remain

## Rules

1. Do **not** re-export or overwrite from Framer.
2. Do **not** re-enable script_main.mjs or data-framer-hydrate-v2.
3. Do **not** “sync” this folder from another remote template on deploy.
4. Only change this landing when explicitly asked to update the locked homepage.

Locked: 2026-09-17
