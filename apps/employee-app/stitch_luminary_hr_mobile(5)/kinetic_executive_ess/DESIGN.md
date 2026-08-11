---
name: Kinetic Executive ESS
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  stack-gap-lg: 24px
  stack-gap-md: 16px
  stack-gap-sm: 8px
  section-margin: 32px
---

## Brand & Style

The design system is engineered for a high-performance HR environment, blending the precision of **Linear** with the accessibility of **Revolut**. The brand personality is "Intelligent Orchestration"—it feels authoritative yet effortless. The target audience consists of modern professionals who expect their enterprise tools to match the quality of their premium consumer apps.

The aesthetic follows a **Corporate / Modern** style with heavy influences from **Glassmorphism** and **Minimalism**. The UI relies on expansive whitespace, refined typography, and subtle depth to organize complex HR data into digestible, actionable flows. Every interaction is designed to feel fluid and instantaneous, moving away from the "form-heavy" legacy of ERPs toward a "stream-based" mobile experience.

## Colors

The palette is anchored by a deep **Primary Blue (#2563EB)** to convey trust and reliability, paired with an **Electric Purple (#7C3AED)** used exclusively for AI-driven features and secondary actions. 

- **Functional Colors:** Success, Warning, and Error colors follow standard semantic patterns but are slightly desaturated to maintain the premium aesthetic.
- **Surface Strategy:** In light mode, surfaces use pure white or extremely light cool grays to define boundaries. In dark mode, a "Modern Charcoal" (#0A0A0A) base is used with slightly lighter charcoal (#171717) for elevated cards, ensuring deep contrast without the harshness of pure black.
- **Gradients:** Subtle linear gradients (Primary to Secondary) are reserved for high-impact moments like "Payroll Disbursed" or "Promotion" celebrations.

## Typography

This design system utilizes **Inter** exclusively to achieve a systematic, neutral, and highly readable interface. 

- **Hierarchy:** We use high-contrast weight shifts rather than color shifts to denote importance. Headlines are always Bold or Semi-Bold with tight letter-spacing (-0.02em) for a modern, compact feel.
- **Body Text:** Main content is set at 16px to ensure accessibility on the move. Secondary information uses 14px Regular.
- **Labels:** Small labels (12px) use Semi-Bold weight and are often paired with increased letter spacing for categorization headers.
- **Buttons:** All button labels use Medium weight to distinguish them clearly from surrounding body text.

## Layout & Spacing

The layout follows a **Fluid Grid** approach tailored for mobile viewports. It utilizes a 4px baseline grid to ensure all elements align harmoniously.

- **Margins:** A generous 20px horizontal margin is maintained on all screens to create a high-end, airy feel.
- **Vertical Rhythm:** Sections are separated by 32px of white space. Internal card components use 16px padding.
- **Touch Targets:** All interactive elements maintain a minimum 44x44px hit area, even if the visual representation is smaller.
- **Safe Areas:** Strict adherence to mobile safe areas, particularly for the 5-tab bottom navigation and the floating AI action button.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and **Glassmorphism**.

- **Level 0 (Background):** Pure white or Modern Charcoal.
- **Level 1 (Cards):** These are the primary containers. They feature a 16px corner radius and a very soft, diffused shadow (0px 4px 20px rgba(0,0,0,0.05)).
- **Level 2 (Overlays/Modals):** These utilize a backdrop blur (20px) with a semi-transparent white or dark fill (80% opacity). This creates a sense of spatial context, allowing the user to see the previous screen behind the active modal.
- **Borders:** Instead of heavy shadows for every element, use 1px subtle borders (#E2E8F0) to define secondary inputs and dividers, maintaining a clean, "flat-plus" appearance.

## Shapes

The design system utilizes a **Rounded (Level 2)** shape language to evoke friendliness and modernism.

- **Primary Cards:** 16px (`rounded-lg`) is the standard for all dashboard widgets and content containers.
- **Buttons:** Fully rounded (pill-shaped) for primary actions to distinguish them from the rectangular layout of the cards.
- **Inputs:** 12px roundedness to sit comfortably within 16px cards.
- **Badges:** Small 4px-8px radius or fully pill-shaped depending on the content length.

## Components

### Buttons
- **Primary:** Solid #2563EB with white text. Pill-shaped. Subtle lift on tap.
- **Secondary:** Transparent background with a 1px border or light tint of primary color.
- **AI Assistant:** A floating action button (FAB) featuring a subtle purple-to-blue gradient and a 15px backdrop blur.

### Cards
- **Structure:** 16px corner radius. Standard 20px internal padding.
- **Interactive:** Slight scale-down (0.98) on press to provide tactile feedback.

### Navigation
- **Bottom Bar:** 5-tab layout using blurred glassmorphism. Active states are indicated by a primary color icon and a subtle 4px dot below the label.
- **Chips:** Used for filtering leave types or status. High-contrast colors for "Approved" (Success) or "Pending" (Warning).

### Lists & Inputs
- **Lists:** No dividers; use 8px spacing between list item cards to maintain the "card-stream" aesthetic.
- **Inputs:** Floating labels with Inter 14px. On focus, the border transitions to Primary Blue with a 2px outer glow.

### Specialized HR Components
- **Progress Bars:** Thin (4px) with rounded caps for tracking leave balances or probation periods.
- **Salary Snapshot:** High-fidelity card featuring a blurred "Privacy" mode that can be toggled to hide sensitive numbers.