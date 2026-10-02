# Mobile Audit — Shaver Team Commission Tracker

**Date:** 2026-10-02 · **Status:** Phase 1 complete · Fix plan **approved by Malcolm 2026-10-02** (including C-01) · Phase 2 in progress — batch 1 done
**Scope:** whole app. Consumer-facing = salesperson screens (full depth). Internal = admin screens (baseline tier: no horizontal overflow, usable forms, readable tables).

## Phase 0 — Discovery

| Item | Finding |
|---|---|
| App type | Responsive web app (not a PWA, not native). No web manifest or service worker; `src/app/icon.png` + `apple-icon.png` only. |
| Framework / router | Next.js 16.3 App Router (Turbopack), React 19, server components + server actions |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), custom `@utility` classes; no component library |
| Global styles & tokens | `src/app/globals.css` (`@theme` colors/fonts; `card`, `btn-*`, `input`, `field-label`, `chip`, `table-head` utilities). Fonts via `next/font` in `src/app/layout.tsx`. |
| Viewport meta | Not declared — Next.js default renders `width=device-width, initial-scale=1` (verified in every rendered page). No zoom cap. No `viewport-fit`. No `themeColor`. |
| Shared layout components | `src/components/app-shell.tsx` (sticky header + impersonation banner + horizontal tab nav), `nav-link.tsx`, `deal-fab.tsx` (fixed bottom-right CTA), `month-nav.tsx`, `stat-tile.tsx`, `tier-ladder.tsx`, `units-gauge.tsx`, `deal-list.tsx`, `charts/bar-chart.tsx`, `charts/pace-chart.tsx`, `action-form.tsx`. No modal/drawer/sheet components exist. Inputs/buttons are utility classes, not components. |
| Playwright | Installed for the audit (`playwright@1.63`, dev dependency) with Chromium + WebKit. Script: `scripts/mobile-audit.ts` → `npm run audit:mobile`. |

### Routes

| Route | Surface | Forms | Tables | Charts | Fixed / sticky |
|---|---|---|---|---|---|
| `/login` | consumer | ✓ | | | |
| `/change-password` | consumer | ✓ | | | |
| `/dashboard` (+ `?month=`) | consumer | | | ✓ pace + bar | header, FAB |
| `/history` | consumer | | ✓ (7 cols) | | header, FAB |
| `/deals/new`, `/deals/[id]` | consumer | ✓ (main task) | | | header (FAB hidden) |
| `/admin` (Store) | internal | | | ✓ pace + bar | header, FAB |
| `/admin/deals` | internal | ✓ inline back gross | ✓ (7 cols, 860px) | | header, FAB |
| `/admin/spiffs` | internal | ✓ | ✓ (4 cols) | | header, FAB |
| `/admin/staff` | internal | ✓ (per person, in `<details>`) | | | header, FAB |
| `/admin/settings` | internal | ✓ (tiers, holidays, products) | ✓ (holidays) | | header, FAB |

## Method

- **Static scan:** grep of `src/` for fixed widths, `vh`/`h-screen`, fixed/sticky, tables, input classes, hover-only styles, `title=`, `autoFocus`, sub-12px text, images, motion.
- **Rendered scan:** `scripts/mobile-audit.ts` — 12 routes × 5 viewports (360×740, 375×667, 390×844, 430×932, 768×1024) × Chromium (mobile emulation, touch) + WebKit = 120 page loads, against a local production build. Logged in with temporary QA accounts; salesperson data screens viewed read-only through admin "View as". Results: `audit/results/before/*.json`; screenshots: `audit/screenshots/before/<route>-<width>-<engine>.png` (**gitignored — they show customer names**).
- **Lighthouse 12 (mobile)** on the 5 consumer routes: `audit/lighthouse/*.json` (gitignored).

### Baseline numbers (phones only: 96 page loads)

| Metric | Count |
|---|---|
| Pages with horizontal overflow | **0** |
| Console errors | **0** |
| Tap targets under 44×44 (element instances) | 3,056 |
| Inputs/selects/textareas under 16px | 1,256 (every field — all use the shared `input` utility at 14px) |
| Text elements under 12px | 648 |
| Tap-target pairs closer than 8px | 29 |

| Lighthouse (mobile) | Perf | A11y | Best practices | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| `/login` | 97 | 100 | 100 | 2.5 s | 0 | 0 ms |
| `/dashboard` (empty) | 95 | 91 | 100 | 2.9 s | 0 | 20 ms |
| `/deals/new` | 97 | 96 | 100 | 2.7 s | 0 | 0 ms |
| `/dashboard` (with data) | 96 | 92 | 96 | 2.8 s | 0 | 10 ms |
| `/history` | 98 | 96 | 100 | 2.3 s | 0 | 10 ms |

LCP is measured from a laptop to the remote database; production on Vercel is in the same region as the database and should be faster.

## 1. Executive summary

The app's **foundation is sound**: correct viewport tag, zoom never disabled, `dvh` units already used, zero horizontal overflow on any route at any size in either engine, no layout shift, no console errors, good Lighthouse performance. The defects are the classic "built in a desktop preview" set: **14px form fields (iOS zooms in on every field), small tap targets on the main navigation, chart details that only appear on mouse hover, and faint grey text that fails contrast.**

| Severity | Count | Categories |
|---|---|---|
| Critical | 0 | — |
| High | 6 | Forms (2), Touch (3), Accessibility (1) |
| Medium | 11 | Forms (1), Touch (5), Content (3), Accessibility (2) |
| Low | 9 | Foundation (2), Forms (1), Touch (2), Content (2), Accessibility (1), Performance (1) |

**Top 5 by user impact**
1. **M-01** Every form field is 14px → iOS Safari zooms in when a salesperson taps any field on login, password change, and Log Deal.
2. **T-02** Month back/forward arrows are 35×28px — the main way salespeople move between months.
3. **T-01** Tab navigation (Dashboard / History, admin tabs) is 32px tall.
4. **T-09** Chart details (each month's units, pace on a given day) only show on mouse hover; on a phone most bars have no readable value.
5. **A-01** The faintest grey text (`on-surface-subtle` #686877) is ~3.2:1 on cards — fails WCAG AA (4.5:1); used for captions, "Sign out", chips, chart axes.

## 2. Findings

Status column is updated in Phase 2. Evidence screenshots are at `audit/screenshots/before/<route>-375-webkit.png` unless noted.

| ID | Category | Sev | Route(s) / Component | Evidence | Proposed fix | Fix level | Risk | Real device? | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | 1 Viewport | Pass | all | Rendered meta `width=device-width, initial-scale=1`; no `user-scalable`/`maximum-scale` | None | — | — | No | Pass |
| F-02 | 1 Layout | Pass | all | 0 overflow at 360–768 in both engines; tables already in `overflow-x-auto` | None | — | — | No | Pass |
| F-03 | 1 Viewport units | Pass | `layout.tsx:17`, `login/page.tsx:7`, `change-password/page.tsx:11` | `min-h-dvh` already used; no `vh`/`h-screen` | None | — | — | No | Pass |
| F-04 | 2 Safe areas | Low | `deal-fab.tsx:13`, `app-shell.tsx:14` | No `viewport-fit=cover`, so the browser keeps content out of the notch/home-indicator area; FAB sits 20px above the bottom | **Don't** add `viewport-fit=cover` (nothing needs edge-to-edge). Revisit only if the app becomes an installed PWA | — | — | Yes (iPhone with home indicator) | Recommend no change |
| F-05 | 1 Viewport | Low | `layout.tsx` | No `themeColor` — Safari/Chrome toolbar stays default white/grey against a black app | `export const viewport = { themeColor: "#0e0e11" }` (keeps default width/scale) | token | Low | Yes (toolbar tint) | Fixed (batch 1) — toolbar tint needs a real phone |
| M-01 | 4 Forms | **High** | all forms (1,256 instances) | `globals.css:59` `input` utility is `text-sm` (14px); inputs measure 14px in Chromium + WebKit | `text-base sm:text-sm` in the `input` utility (also lifts field height 42→46px, fixing M-06) | token | Low | Yes (zoom-on-focus is iOS-only) | Fixed (batch 1) — phones 16px / 46px tall (0 sub-16px inputs, was 1,256); iOS no-zoom needs a real iPhone |
| M-02 | 4 Forms | **High** (internal) | `/admin/spiffs` amount | `spiffs/page.tsx:41` `inputMode="decimal"`; page says "use a negative number for a chargeback" — iOS decimal keypad has no minus key | Drop `inputMode` (full keyboard) so "-250" can be typed on iPhone | local | Low | Yes | Open |
| M-03 | 4 Forms | Medium (internal) | `/admin/staff` password | `staff/page.tsx:64` `type="text"` without `autoCapitalize`/`autoCorrect` — iOS may capitalize or autocorrect a temporary password | `autoCapitalize="none" autoCorrect="off" spellCheck={false}` | local | Low | Yes | Open |
| M-04 | 4 Forms | Low | `/deals/new` stock # | `deal-form.tsx:75` — stock numbers are stored uppercase but keyboard starts lowercase | `autoCapitalize="characters"`; `enterKeyHint="next"` on text fields | local | Low | Yes | Open |
| M-05 | 4 Forms | Low | `/login`, `/change-password` | No `enterKeyHint` | `enterKeyHint="go"` (login password) / `"done"` (confirm) | local | Low | Yes | Open |
| M-06 | 5 Touch | (in M-01) | all inputs | Fields 42px tall (<44) | Resolved by M-01 | token | — | No | Fixed (batch 1) (via M-01) |
| T-01 | 5 Touch | **High** | header nav, all app routes | `nav-link.tsx:12` tabs 32px tall | `min-h-11` (44px) + matching padding | shared component | Low | No | Open |
| T-02 | 5 Touch | **High** | `/dashboard`, `/admin`, `/admin/deals`, `/admin/spiffs` | `month-nav.tsx:10` arrows 35×28 | 44×44 hit area (`h-11 w-11` centered arrows) | shared component | Low | No | Open |
| T-03 | 5 Touch | Medium | header, all routes | Sign out 63×16 (`app-shell.tsx:45`), Exit view 93×24 (`:22`), logo link 36×36 | `min-h-11` + padding on each; logo link padded to 44 | shared component | Low | No | Open |
| T-04 | 5 Touch | Medium (internal) | `/admin`, `/admin/staff`, `/admin/deals`, `/admin/settings`, `/admin/spiffs` | 16px-tall text actions: View as (`view-as-button.tsx:6`), History (`admin/page.tsx`), Edit 30×15 ×87 rows (`admin/deals/page.tsx:80`), Remove (`remove-button.tsx`, `remove-holiday-button.tsx`) | `inline-flex min-h-11 items-center px-2` on each (visual text unchanged) | shared component + 3 local | Low | No | Open |
| T-05 | 5 Touch | Medium (internal) | `/admin/staff`, `/admin/settings` | Checkbox labels 20px tall (`staff/page.tsx:81`), product "Active" 32px | `min-h-11` on the labels | local | Low | No | Open |
| T-06 | 5 Touch | Medium | `/deals/new`, `/deals/[id]` | Product / 90-day / multi-lingual checkbox rows 42px (`deal-form.tsx:94`) | `py-3` → ≥44px | local | Low | No | Open |
| T-07 | 5 Touch | Low | `/history` | Month links 17px tall inside 44px rows (`history/page.tsx:56`) | Make link `block py-3` | local | Low | No | Open |
| T-08 | 3/5 Keyboard + Touch | Medium | FAB on `/admin/*`, `/dashboard`, `/history` | `deal-fab.tsx:13` overlaps the last fields/buttons on Settings & Spiffs (0px gap); with the keyboard open it can float over the field being typed in | Hide the FAB while any form field has focus (CSS `body:has(:focus)` rule — no JS) | shared component | Low | **Yes** | Open |
| T-09 | 5 Touch | **High** | dashboard + store charts | `bar-chart.tsx:64` values only in hover/focus tooltip (all bars except peak/current unlabeled); `pace-chart.tsx:73` uses `onMouseMove` only — no touch scrubbing | Pace chart: pointer events (tap & drag works on touch). Bar chart: tap shows the tooltip (focusable bars with `role="img"`), tested in WebKit touch emulation | shared component | Low | **Yes** (tap-to-focus on iOS) | Open |
| T-10 | 5 Touch / 9 A11y | Low | all buttons/links | No `:focus-visible` styling; `:active` only via scale | Global `focus-visible` ring in the primary color | token | Low | No | Fixed (batch 1) — 2px primary outline on keyboard focus (inputs keep their own ring) |
| C-01 | 6 Content | Medium | `/history` | `history/page.tsx:40` 7-column table at `min-w-[640px]`: at 360px the Total column needs a sideways scroll | Priority columns on phones: hide "2-Car", "Hat Trick", "Deals only" below `sm` (Month, Units, Best, Total stay); all columns from 640px up | local | Low–Med (hides columns on phones; data still on each month's dashboard) | No | Approved (in blanket plan approval) — Open |
| C-02 | 6 Content | Low (internal) | `/admin/deals` | 860px table in `overflow-x-auto` — readable via sideways scroll (baseline met) | No change now; cards would be a redesign | — | — | No | Recommend no change |
| C-03 | 6 Content | Low (internal) | `/admin/spiffs`, `/admin/settings` holidays | Tables in `overflow-hidden` cards (`spiffs/page.tsx:51`, `settings/page.tsx:97`) — fit today (326px), a long note would be clipped | `overflow-x-auto` on those wrappers | local | Low | No | Open |
| C-04 | 6 Navigation | Medium (internal) | admin nav, all admin routes | Nav is 437px wide on a 360px screen; "Settings" mostly off-screen with no scroll hint | Tighter mobile padding + right-edge fade so it reads as scrollable | shared component | Low | No | Open |
| C-05 | 6 Sticky UI | Medium (internal) | "View as" mode | Banner + header + nav = 188px sticky on phones (28% of a 667px screen) | On phones: shorter banner copy ("Viewing as {name} · Exit") on one line | shared component | Low | No | Open |
| A-01 | 9 Contrast | **High** | all routes | Lighthouse `color-contrast` fails on dashboard, deal-new, history; `globals.css:15` `--color-on-surface-subtle: #686877` ≈ 3.2:1 on card backgrounds | Lighten the token to the nearest grey passing 4.5:1 on all surfaces (computed, ~#8a8a98) | token | Low (subtle text slightly lighter) | No | Fixed (batch 1) — token now #868695 (4.52:1 on #202026, 4.93:1 on cards) |
| A-02 | 8/9 Typography | Medium | all routes (648 instances) | Lighthouse `font-size` fails on dashboard-data (8.5% of text <12px); `field-label`, `chip`, `table-head` utilities at 11px; 8× `text-[10px]`, 10× `text-[11px]` (charts, tier ladder, captions) | Raise the three utilities and all 10/11px text to 12px (`text-xs`) | token + local | Low (slightly larger captions) | No | Partly fixed (batch 1: `field-label`/`chip`/`table-head` → 12px; sub-12px text 648 → 288) — rest in batches 2–3 |
| A-03 | 9 A11y | Medium | dashboard + store charts | Lighthouse `aria-prohibited-attr`: `bar-chart.tsx:64` `aria-label` on a role-less `div` | `role="img"` on each bar (part of T-09) | shared component | Low | No | Open |
| A-04 | 9 A11y | Low | skeleton, FAB, buttons | No `prefers-reduced-motion` handling (`animate-pulse`, `active:scale-95`, transitions) | Global reduced-motion rule | token | Low | No | Fixed (batch 1) |
| P-01 | 7 Performance | Low | dashboards | LCP 2.8–2.9s locally (server data); CLS 0; images sized + `priority`; fonts via `next/font` (swap); skeleton + empty states exist | No change now; re-measure on production | — | — | No | Recommend no change |

**Not tested automatically (needs a real phone):** 200% / large OS text sizes, real iOS keyboard behavior, Safari toolbar collapse, gestures, notch/home-indicator safe areas.

**Audit-script caveats:** tap-target counts include every table row action, so counts are large on admin tables; "crowded" uses the gap between boxes (<8px) rather than center distance, which better reflects mis-taps.

## 3. Recommended NOT to fix automatically

| Item | Why |
|---|---|
| Add `viewport-fit=cover` (F-04) | Nothing needs to draw under the notch; adding it would require safe-area padding everywhere for no gain. |
| `interactive-widget=resizes-content` | On Android it would make the floating Log Deal button ride up above the keyboard — the opposite of what we want. |
| Convert the admin Deals table to cards (C-02) | Redesign-level; the scroll table meets the internal baseline and inline back-gross entry works. |
| Always-on value labels on every bar (beyond T-09) | Changes the chart design; tap-to-see restores access without changing the look. |
| Bottom tab bar for salesperson nav | Navigation redesign; the existing two-tab header works once targets are 44px. |

## 4. Proposed fix order (impact ÷ risk) — one commit per batch

| Batch | Contents | Files |
|---|---|---|
| **1 — Foundation (tokens & global CSS)** | M-01/M-06 input 16px, A-01 contrast token, A-02 utilities → 12px, T-10 focus-visible, A-04 reduced motion, F-05 themeColor | `globals.css`, `layout.tsx` |
| **2 — Shared components** | T-01 nav, C-04 nav affordance, T-02 month arrows, T-03 header buttons, C-05 banner, T-08 FAB-on-focus, T-04 View-as button, T-09/A-03 charts, A-02 chart/tier text | `nav-link.tsx`, `app-shell.tsx`, `month-nav.tsx`, `deal-fab.tsx`, `view-as-button.tsx`, `charts/*`, `tier-ladder.tsx`, `units-gauge.tsx`, `deal-list.tsx`, `stat-tile.tsx` |
| **3 — Page-level** | M-02, M-03, M-04, M-05, T-04 (local), T-05, T-06, T-07, C-03, A-02 (remaining 10/11px), C-01 if approved | `deal-form.tsx`, `login-form.tsx`, `change-password-form.tsx`, `admin/{deals,spiffs,staff,settings}/*`, `admin/page.tsx`, `history/page.tsx`, `dashboard/page.tsx` |

After each batch: re-run `npm run audit:mobile` on affected routes, confirm targeted findings resolved and nothing regressed, run `scripts/verify.sh`, commit.

## Handoff — how to continue (Phases 2–4)

**Where things stand (2026-10-02):** audit and report done; plan approved; no app code changed yet. Baseline evidence: `audit/results/before/` and `audit/screenshots/before/` (local only, gitignored). Lighthouse before: `audit/lighthouse/*.json` (local only).

**Run the audit**
1. `npm run build && npm start` (or `preview_start` → `prod` in `.claude/launch.json`).
2. `npm run qa:accounts -- create /tmp/shaver-audit.env` — temporary QA logins (production DB; QA staff show on the live Store leaderboard until deleted).
3. `npx tsx --env-file=/tmp/shaver-audit.env scripts/mobile-audit.ts [--routes a,b] [--widths 375] [--engines webkit] [--no-screenshots]`
   (the `npm run audit:mobile` script is the same without the env file).
4. Results overwrite `audit/results/<engine>.json` and `audit/screenshots/*.png` — move "before" copies aside before re-running if needed (already done: `before/`).
5. **Always** `npm run qa:accounts -- delete` afterwards.

**Gotchas found during the audit**
- tsx injects `__name()` into functions; the script defines it in the page via `addInitScript` — keep that line.
- Checks run before a whole Bash command: never put cleanup and `git commit` in one command (the verify hook evaluates the tree before cleanup runs).
- Lighthouse on logged-in routes: `npx -y lighthouse@12 <url> --extra-headers=<json file with {"Cookie": "..."}>`; get cookies by logging in with Playwright; add `view_as=<AUDIT_VIEW_AS>` to the admin cookie for populated salesperson screens.
- Contrast target for A-01: compute against the lightest surface it sits on (`surface-card-hover` #202026) — needs relative luminance ≥ ~0.243.

**Remaining phases (from the original brief)**
- **Phase 2:** batches 1→3 above, one commit each; after each: re-run the audit for affected routes, `scripts/verify.sh`, update the Status column here.
- **Phase 3:** full re-run (all routes × widths × engines), before/after counts per category, `audit/screenshots/after/` for every High finding, Lighthouse after for the 5 consumer routes, `npm run build`.
- **Phase 4:** `audit/DEVICE_TEST_CHECKLIST.md` (non-technical iPhone Safari + Android Chrome steps); "Mobile Standards (non-negotiable)" section in root `CLAUDE.md` (keep ≤ 200 lines; add origin comments); keep `npm run audit:mobile` documented. No CI exists, so no CI step.
