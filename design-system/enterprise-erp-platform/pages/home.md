# Home — Page Override

> Overrides MASTER only where noted. Apple-inspired monochrome ERP home.

**Project:** Connect Plus / iConnect Plus  
**Page:** Home (`/home`)  
**Stack:** Next.js + TypeScript + Tailwind + Lucide  

## Direction

- **Palette:** White `#FFFFFF` / `#F5F5F7`, Black `#1D1D1F`, Grey `#6E6E73` / `#86868B` / `#D2D2D7` / `#E8E8ED`
- **Color elsewhere:** Charts + alert banners only
- **Type:** SF Pro / system stack — large tracking-tight headlines, restrained labels
- **Icons:** Lucide only, stroke 1.5–1.75, monochrome
- **Motion:** 150–300ms fade/rise; respect `prefers-reduced-motion`
- **Density:** High dashboard data, Swiss whitespace hierarchy

## Composition

1. Hero: greeting + date/time + refresh (no colored KPI band)
2. KPI strip: hairline dividers, black numerals, grey labels
3. Chart grid: pipeline / activity / share — color in series only
4. Department table: monochrome rows; status uses alert colors

## Anti-patterns

- No teal/sky chrome, no gradient headline bands, no emoji icons
