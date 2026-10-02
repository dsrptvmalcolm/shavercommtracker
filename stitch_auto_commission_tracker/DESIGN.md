---
name: High-Octane Automotive
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d1c6ab'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9a9078'
  outline-variant: '#4d4632'
  surface-tint: '#eec200'
  primary: '#ffecb9'
  on-primary: '#3c2f00'
  primary-container: '#facc15'
  on-primary-container: '#6c5700'
  inverse-primary: '#735c00'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#b3ffbb'
  on-tertiary: '#003915'
  tertiary-container: '#57ec7f'
  on-tertiary-container: '#00682c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe083'
  primary-fixed-dim: '#eec200'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-hero:
    fontFamily: Anton
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 60px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-xl:
    fontFamily: Anton
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: 0.03em
  headline-xl-mobile:
    fontFamily: Anton
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: 0.03em
  headline-lg:
    fontFamily: Anton
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 34px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '800'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  button-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '800'
    lineHeight: 18px
    letterSpacing: 0.04em
  nav-item:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.08em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
  space-2xl: 4rem
---

## Brand & Style

This design system channels an assertive, high-impact automotive dealership aesthetic defined by raw visual punch, unyielding confidence, and immediate clarity. Built around a pitch-black and dark graphite environment pierced by intense signal yellow accents, the UI commands authority while remaining approachable and action-oriented.

The design movement combines **High-Contrast Bold** with **Industrial Automotive Modernism**:
- Heavy uppercase typography with commanding vertical weight anchors headlines, navigation, and key conversion points.
- High-contrast visual layering keeps user attention focused directly on vehicle search, lead capture, and department transparency.
- A dark backdrop eliminates ambient distraction, elevating vehicle photography and high-priority callouts to primary focal planes.

## Colors

The palette establishes an aggressive dark-mode environment dominated by deep asphalt tones and electric yellow highlights.

- **Primary (`#FACC15`)**: A high-luminance, rich electric amber-yellow derived from automotive branding and safety striping. Used for primary CTA buttons, table headers, active states, search outlines, and brand insignia.
- **Secondary / Canvas Base (`#121212`)**: The foundational black substrate providing infinite contrast against white typography and high-saturation badges.
- **Neutral / Surface Elevators (`#1A1A1A` to `#262626`)**: Charcoal container backgrounds providing structural separation without relying on harsh divider lines.
- **Tertiary (`#22C55E`)**: High-visibility energetic green reserved strictly for live communication triggers (e.g., "Text Us" floating action anchors).
- **Text & Foregrounds**: Pure white (`#FFFFFF`) for display headers, transitioning to neutral light gray (`#D4D4D8` / `#A1A1AA`) for supporting body copy and metadata.

## Typography

Typography delivers an unmistakable two-tiered contrast:
1. **Display & Primary Anchors (`Anton`)**: High-impact, condensed, and architectural. Used strictly in uppercase format for top-level page banners, section declarations, and impactful brand headers. Letter-spacing is dialed slightly loose (`0.02em` to `0.04em`) to maintain legibility at massive scale.
2. **System Interface & Narrative Body (`Inter`)**: An ultra-clean, neutral grotesque workhorse balancing the intense display face. Weights span regular (`400`) for descriptive copy and quotes, up to extra-bold (`800`) for navigation items, data headers, and solid action buttons.

## Layout & Spacing

The layout is grounded in a sturdy 12-column fluid grid on desktop that consolidates into 4 columns on mobile devices:
- **Desktop Breakpoint (1024px+)**: Max container width of 1440px centered with `margin: 3rem`. Form and detail layouts split into asymmetric arrangements (e.g., 7-column content/locations vs. 5-column sticky lead capture).
- **Tablet Breakpoint (768px - 1023px)**: 8-column layout with 2rem margins, transitioning large split blocks into stacked arrangements.
- **Mobile Breakpoint (&lt;768px)**: 4-column layout with 1.25rem outer margins and continuous vertical scrolling flow.

Vertical rhythm relies on generous `space-2xl` section buffers alternating between dark surface backdrops, maintaining breathable negative space around heavyweight titles.

## Elevation & Depth

This system intentionally departs from soft, diffuse drop shadows in favor of **Tonal Layering** and **High-Contrast Geometric Boundaries**:

- **Ground Level (`#0B0B0B`)**: Outer viewport boundary and background hero imagery base.
- **Level 1 Surface (`#141414` / `#181818`)**: Primary canvas bands, content wrappers, and grid layouts.
- **Level 2 Container (`#202022`)**: Form card frames, lead conversion boxes, and search inputs. Outlined with a razor-thin border (`1px solid #333333`) to ensure distinct perimeter definition.
- **Overlay & Popovers**: Floating contact widgets and dialogs sit on top of dark backdrops with a sharp, low-spread ambient halo (`0 8px 24px rgba(0, 0, 0, 0.6)`).

## Shapes

The shape system adopts a **Soft Industrial** geometry (`roundedness: 1`):
- Action buttons, input wrappers, and form containers use subtle 4px to 6px radii (`rounded-md`), avoiding whimsical curves while eliminating razor-sharp corners for a clean, precision-tooled automotive feel.
- Floating communicative elements (like the chat button) adopt an intentional full pill form (`rounded-full`) to contrast against the architectural rectangular grid of inventory and form components.

## Components

### Buttons
- **Primary Action**: Solid `#FACC15` background with pitch black text (`#000000`), uppercase heavy typography (`font-weight: 800`), 6px border-radius, and generous horizontal padding (`1.5rem`). No border; hover state applies an intense glow or slight brightness lift.
- **Secondary Outline / Neutral Fill**: Dark gray background (`#262626`) or border-only outline in primary yellow with white or yellow text.
- **Floating Communication CTAs**: Pill-shaped (`rounded-full`) green (`#22C55E`) or yellow anchors placed at the bottom-right viewport with bold icons and legible text labels.

### Input Fields & Search Bars
- **Surface**: Dark charcoal (`#1E1E20`) interior with a fine 1px border (`#3F3F46`).
- **Focus State**: Crisp 1.5px border glow in primary yellow (`#FACC15`) with no ambient dispersion blur.
- **Labels**: High-legibility uppercase tags positioned directly above or floating along the upper field edge in muted gray (`#A1A1AA`), transitioning to crisp white upon activation.

### Cards & Lead Capture Forms
- Enclosed dark containers (`#18181A`) paired with 1px neutral borders (`#2E2E32`).
- Form cards use stacked input groups separated by `space-md` with primary action buttons spanning the full width of the card base.

### Data Tables & Schedules
- Column headers are flooded in bold primary yellow (`#FACC15`) with sharp black text (`#000000`) in uppercase styling.
- Data rows feature dark alternating charcoal zebra fills (`#141416` and `#1C1C1E`) divided by subtle 1px dividers (`#27272A`).