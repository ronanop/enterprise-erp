# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Enterprise ERP Platform
**Generated:** 2026-07-20 10:05:33
**Category:** B2B Service / Enterprise ERP
**Design Dials:** Variance 2/10 (Centered / Minimal) | Motion 3/10 (Subtle) | Density 8/10 (Dense / Dashboard)

> **ERP note:** Auto-generated marketing style was replaced with **Data-Dense Dashboard + Swiss Minimalism** for authenticated app UI.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0F172A` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#334155` | `--color-secondary` |
| Accent/CTA | `#0369A1` | `--color-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#020617` | `--color-foreground` |
| Muted | `#E8ECF1` | `--color-muted` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#0F172A` | `--color-ring` |

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** minimal, clean, swiss, functional, neutral, professional

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value |
|-------|-------|
| `--space-xs` | `2px` |
| `--space-sm` | `4px` |
| `--space-md` | `8px` |
| `--space-lg` | `12px` |
| `--space-xl` | `16px` |
| `--space-2xl` | `24px` |
| `--space-3xl` | `32px` |

---

## Style Guidelines

**Primary Style (App UI):** Data-Dense Dashboard + Minimalism & Swiss Style

**Locked Stack:** Next.js 16+ · TypeScript · Tailwind · ShadCN UI · Lucide icons

### Page Pattern

**Pattern Name:** Enterprise App Shell (not marketing landing)

- **Layout:** Persistent sidebar + topbar + content workspace
- **CTA Placement:** Primary actions in page header / toolbar

## Anti-Patterns (Do NOT Use)

- ❌ Playful design / AI purple-pink gradients / dark-mode-by-default
- ❌ Emojis as icons — use Lucide/Heroicons
- ❌ Missing `cursor:pointer` / layout-shifting hovers / invisible focus states

## Pre-Delivery Checklist

- [ ] Lucide/Heroicons only; `cursor-pointer` on clickables
- [ ] Hover transitions 150–300ms; contrast ≥ 4.5:1
- [ ] Focus states visible; `prefers-reduced-motion` respected
- [ ] No AI purple/pink gradients; light shell by default
- [ ] Responsive: 375 / 768 / 1024 / 1440
