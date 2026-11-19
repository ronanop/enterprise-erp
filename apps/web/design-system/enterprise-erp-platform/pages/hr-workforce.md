# Hr Workforce Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Generated:** 2026-07-22 15:07:12
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero (Search focused), 2. Categories, 3. Featured Listings, 4. Trust/Safety, 5. CTA (Become a host/seller)

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Search: High contrast. Categories: Visual icons. Trust: Blue/Green.

### Component Overrides

- No overrides — use Master component specs

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Spring animations (mass:1 damping:15 stiffness:120); gradient buttons (0052FF→4D7CFF); scale press 0.96→1.0 with haptics; floating FAB with gentle bobbing (Reanimated); glassmorphism BlurView navigation bars; staggered fade-in entrance (Y:20→0 + opacity:0→1); pulsing status dot on section badges; layout transitions (LayoutAnimation or Reanimated entering)
- CTA Placement: Hero Search Bar + Navbar 'List your item'
