---
name: oku
description: Central Asian Cartographic Atlas — a dual-theme (light & dark) editorial-learning design system for Kyrgyzstan Grade 9+ education.
colors:
  atlas-parchment: "#F5F1E8"
  atlas-paper: "#FFFDF9"
  atlas-hover: "#ECE6D8"
  atlas-border: "#D6CFC2"
  control-border: "#8A8375"
  atlas-ink: "#1F2937"
  atlas-ink-muted: "#57534E"
  prussian-cobalt: "#1D3557"
  prussian-cobalt-deep: "#152843"
  vermilion-accent: "#C84B31"
  vermilion-hover: "#B03E26"
  night-slate: "#12161C"
  night-plate: "#1A2029"
  night-hover: "#232B37"
  night-border: "#2B3442"
  night-control-border: "#6B7688"
  night-ink: "#F5F1E8"
  night-ink-muted: "#9CA3AF"
  night-cobalt: "#2A4A7F"
  night-vermilion: "#E05D44"
  grade-five: "#15803D"
  grade-four: "#0F766E"
  grade-three: "#B45309"
  grade-two: "#B91C1C"
  night-grade-five: "#4ADE80"
  night-grade-four: "#2DD4BF"
  night-grade-three: "#FBBF24"
  night-grade-two: "#F87171"
  choice-a: "#B83D24"
  choice-a-hover: "#9E321C"
  choice-b-dark: "#2B5082"
  choice-b-dark-hover: "#356099"
  choice-c-hover: "#115E59"
  choice-d: "#92400E"
  choice-d-hover: "#78350F"
typography:
  display:
    fontFamily: "'Golos Text', system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Golos Text', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Golos Text', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "'Golos Text', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  none: "0px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "44px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion-accent}"
    textColor: "{colors.atlas-paper}"
    rounded: "{rounded.xs}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.vermilion-hover}"
  button-secondary:
    backgroundColor: "{colors.prussian-cobalt}"
    textColor: "{colors.atlas-parchment}"
    rounded: "{rounded.xs}"
    padding: "10px 18px"
  card-light:
    backgroundColor: "{colors.atlas-paper}"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.xs}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.night-plate}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.xs}"
    padding: "24px"
  projection-plate:
    backgroundColor: "{colors.atlas-paper}"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.none}"
    padding: "36px"
  choice-tile-a:
    backgroundColor: "{colors.choice-a}"
    textColor: "{colors.atlas-paper}"
    rounded: "{rounded.xs}"
    padding: "16px"
    height: "76px"
  choice-tile-b:
    backgroundColor: "{colors.prussian-cobalt}"
    textColor: "{colors.atlas-paper}"
    rounded: "{rounded.xs}"
    padding: "16px"
    height: "76px"
  choice-tile-c:
    backgroundColor: "{colors.grade-four}"
    textColor: "{colors.atlas-paper}"
    rounded: "{rounded.xs}"
    padding: "16px"
    height: "76px"
  choice-tile-d:
    backgroundColor: "{colors.choice-d}"
    textColor: "{colors.atlas-paper}"
    rounded: "{rounded.xs}"
    padding: "16px"
    height: "76px"
---

# Design System: oku

**Visual World:** Central Asian Cartographic Atlas (`seed:fefcb744958d6bf6`)  
**Mode:** Operate & Read (low-bandwidth mobile-first PWA + desktop teacher studio)  
**Reference Sketch:** [model-pick.html](./.impeccable/mocks/decision/model-pick.html)

---

## Overview

**oku** draws its visual language from post-Soviet Kyrgyz and Central Asian school geographical atlases: warm uncoated paper stock in daylight, deep night-slate atlas plates after dark, a committed Prussian-cobalt navigation rail, and crisp vermilion border rules.

* **Light Theme (Daylight Atlas):** Built for daytime classroom and home study on warm uncoated parchment (`#F5F1E8`) with bright paper reading plates (`#FFFDF9`) that reduce harsh white-screen glare.
* **Dark Theme (Night Atlas Plate):** Built for evening self-study and map exploration on deep charcoal-slate (`#12161C`) with elevated plates (`#1A2029`), preserving WCAG AA contrast without losing the cobalt-and-vermilion atlas identity.
* **Low-Bandwidth Discipline:** Zero heavy blurs, zero decorative raster textures; relies on CSS tokens, inline SVG/TopoJSON maps, and system-friendly web fonts.

---

## Colors

### Semantic Theme Mapping (Light & Dark)

| Semantic Role | Light Theme (`[data-theme="light"]`) | Dark Theme (`[data-theme="dark"]`) | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F5F1E8` (`atlas-parchment`) | `#12161C` (`night-slate`) | Main page background |
| `--bg-surface` | `#FFFDF9` (`atlas-paper`) | `#1A2029` (`night-plate`) | Textbook unit cards, quiz panels, matrix cells |
| `--bg-hover` | `#ECE6D8` (`atlas-hover`) | `#232B37` (`night-hover`) | Interactive row, filmstrip, and ghost-button hover states |
| `--bg-rail` | `#1D3557` (`prussian-cobalt`) | `#152843` (`prussian-cobalt-deep`) | Persistent quarter/unit and Lesson Studio navigation rail |
| `--border-hairline` | `#D6CFC2` (`atlas-border`) | `#2B3442` (`night-border`) | Card borders, matrix gridlines, `<hr>` page breaks |
| `--border-control` | `#8A8375` (`control-border`) | `#6B7688` (`night-control-border`) | Inputs, selects, ghost buttons, and dashed dropzones (`≥3:1`) |
| `--text-primary` | `#1F2937` (`atlas-ink`) | `#F5F1E8` (`night-ink`) | Body copy, headings, table values |
| `--text-secondary` | `#57534E` (`atlas-ink-muted`) | `#9CA3AF` (`night-ink-muted`) | Captions, metadata, timestamps |
| `--accent-primary` | `#C84B31` (`vermilion-accent`) | `#E05D44` (`night-vermilion`) | Active unit highlight, primary CTAs, `4px` stage rules, map pins |
| `--accent-ink` | `#B03E26` (`vermilion-hover`) | `#E05D44` (`night-vermilion`) | Vermilion as text (slide bullet numbers, quiz streak counters) |
| `--accent-secondary` | `#1D3557` (`prussian-cobalt`) | `#2A4A7F` (`night-cobalt`) | Secondary buttons, active studio tabs, interactive map fills |

### Mastery & 5-Point Grade State Colors

State colors are reserved strictly for assessment feedback, mastery heatmaps, and the 5-point grading scale (`2–5`), all meeting `≥4.5:1` contrast:

* **Grade 5 (`--grade-five`, `90–100%` · Excellent):** `#15803D` (`grade-five`, Light) / `#4ADE80` (`night-grade-five`, Dark)
* **Grade 4 (`--grade-four`, `75–89%` · Good):** `#0F766E` (`grade-four`, Light) / `#2DD4BF` (`night-grade-four`, Dark)
* **Grade 3 (`--grade-three`, `60–74%` · Satisfactory):** `#B45309` (`grade-three`, Light) / `#FBBF24` (`night-grade-three`, Dark)
* **Grade 2 (`--grade-two`, `<60%` · Needs review):** `#B91C1C` (`grade-two`, Light) / `#F87171` (`night-grade-two`, Dark)

### Kahoot-Style Geometric Answer Choice Colors

Classroom quiz choices map to four cartographic pigments paired with `--on-choice` (`#FFFDF9`, `atlas-paper`) ink and geometric SVG marks so every tile holds `≥4.5:1` contrast in both themes:

* **Choice A — Triangle (`--choice-a` / `--choice-a-hover`):** Terracotta vermilion `#B83D24` (`choice-a`), hover `#9E321C` (`choice-a-hover`) in Light & Dark.
* **Choice B — Diamond (`--choice-b` / `--choice-b-hover`):** Prussian cobalt `#1D3557` (`prussian-cobalt`), hover `#152843` (`prussian-cobalt-deep`) in Light; lifted in Dark to `#2B5082` (`choice-b-dark`), hover `#356099` (`choice-b-dark-hover`) so the tile separates cleanly from `--bg-surface` (`#1A2029`).
* **Choice C — Circle (`--choice-c` / `--choice-c-hover`):** Atlas teal `#0F766E` (`grade-four`), hover `#115E59` (`choice-c-hover`) in Light & Dark.
* **Choice D — Square (`--choice-d` / `--choice-d-hover`):** Ochre umber `#92400E` (`choice-d`), hover `#78350F` (`choice-d-hover`) in Light & Dark.
* **Choice Foreground (`--on-choice`):** Warm atlas paper `#FFFDF9` (`atlas-paper`) shared across choice copy and `ChoiceShapeMark` icons.

### Named Rules

**The Reserved Grade Spectrum Rule.** Grade greens, teals, ambers, and reds (`--grade-five` through `--grade-two`) are reserved strictly for 5-point assessment feedback and mastery reporting; ingestion and workflow statuses stay in cobalt, muted stone, and vermilion.

---

## Typography

* **Primary UI & Reading Face:** `Golos Text` (with `system-ui, sans-serif` fallback) — chosen specifically for clean, balanced **Kyrgyz (`Ө, ө, Ү, ү, Ң, ң`)** and **Russian** Cyrillic proportions at both display and 16px reading sizes.
* **Tabular & Metadata Face:** `JetBrains Mono` — used with `font-variant-numeric: tabular-nums` for 5-point grades, mastery percentages, running times (`45 мин`), and textbook page markers (`42-б. / стр. 42`).
* **Reading Measure:** Textbook prose is capped at `65ch` max width with `1.65` line-height for comfortable long-form mobile and desktop reading.

---

## Layout

* **Desktop (`≥1024px`):** Two-column shell featuring a fixed `260px` Prussian-cobalt navigation rail (anchored by a `4px` vermilion vertical border rule) and a fluid reading/analytics workspace (`32px 44px` padding).
* **Tablet & Mobile (`<1024px`, budget Android priority):** The `260px` rail collapses into a compact top bar showing the active Quarter & Unit title plus a slide-over syllabus drawer and thumb-friendly bottom pagination (`Previous` / `Next Unit` / `Ask AI Tutor`).
* **Lesson Studio & Student Quiz Layouts (`ThemeShell`):** The shipped `ThemeShell` pins the fixed `260px` cobalt rail at `xl` (`≥1280px`) and renders a compact cobalt top bar (`border-b-4 border-[var(--accent-primary)]`) plus slide-over `<dialog>` drawer (`min(300px, 86vw)`) below `1280px`. Inside `/lessons` (`max-w-[1400px]`), Setup splits at `lg` (`≥1024px`) into `minmax(0, 1fr) + 360px` sticky settings, Slides splits into a `240px` filmstrip + `1fr` `16:9` projection stage, `TeachPresenterModal` claims the full viewport (`max-w-5xl` centered stage), and `/play/[shareCode]` runs rail-free inside a centered `max-w-3xl` mobile-first column.
* **Spacing Rhythm:** Base `8px` scale (`4px`, `8px`, `16px`, `24px`, `32px`, `44px`).

---

## Elevation & Depth

* **Flat Tonal Layering:** Avoid heavy drop shadows (`box-shadow` is omitted on cards to keep low-end Android rendering fast and crisp).
* **Hierarchy via Surface & Rule:** Separate layers using background tone shifts (`--bg-canvas` vs. `--bg-surface`), `1px solid var(--border-hairline)` borders, and `4px` vermilion top/left accent rules on featured map plates, classroom projection stages, or active navigation items.
* **Motion-Gated Plate & Drawer Transitions (`.oku-stage-enter`):** Lesson Studio stage switches and presenter slides use `@keyframes oku-plate-in` (`160ms ease-out`, `opacity: 0 → 1`, `translateY(4px → 0)`) strictly inside `@media (prefers-reduced-motion: no-preference)`. Mobile navigation drawers animate via `oku-drawer-in` (`180ms cubic-bezier(0.16, 1, 0.3, 1)`) with `motion-reduce:open:animate-none`.

### Named Rules

**The Flat Plate & Vermilion Rule.** Surfaces carry zero drop shadows; depth and stage hierarchy come strictly from canvas-to-surface tone shifts, `1px` hairline borders, and a `4px` vermilion rule anchoring the navigation rail and `16:9` projection plates.

---

## Shapes

* **Crisp Cartographic Corners:** Use `4px` (`--rounded-xs`) for textbook plates, buttons, inputs, grade pills, quiz choice tiles, and matrix cells, and `6px–8px` for status pills and modal/drawer containers. Avoid overly bubbly `20px+` radii.
* **Sharp `16:9` Projection Plate (`0px` radius):** Classroom slide canvases (`LessonSlidesPanel` and `TeachPresenterModal`) intentionally omit corner rounding (`0px` radius, `sm:aspect-video` above `640px`, fluid vertical stack on narrow phones) and pair a `1px solid var(--border-hairline)` frame with a `4px` solid vermilion top border (`border-t-4 border-t-[var(--accent-primary)]`).
* **Geometric Choice Marks (`ChoiceShapeMark`):** Inline `16×16` SVG primitives (`triangle`, `diamond`, `circle`, `square`) rendered at `16px–24px` inside quiz options.
* **Page Break Rule (`page_break`):** Rendered as a full-width `1px solid var(--border-hairline)` `<hr>` centered with a pill-shaped `JetBrains Mono` label (`42-б. / стр. 42`).

### Named Rules

**The Redundant Shape-and-Hue Rule.** Every Kahoot-style answer tile pairs its fill token (`--choice-a` through `--choice-d`) with a distinct geometric SVG mark so classroom projection and color-vision differences never depend on hue alone.

---

## Components

* **Quarter & Unit Rail:** Prussian-cobalt background (`--bg-rail`), vermilion active row (`#C84B31` with `#FFFFFF` text), and right-aligned tabular duration/completion indicator.
* **Block AST Reader Cards:** Uncoated paper (`--bg-surface`) with `1px` border; `callout` blocks (`example`, `definition`, `theorem`) use a `4px` left border in cobalt or vermilion.
* **Interactive TopoJSON Map Plate:** Always rendered inside a high-contrast dark-slate or crisp-bordered frame (`--bg-surface` with `4px` vermilion top rule) with clickable SVG country/region polygons, hover tooltips, and `map_pin` quiz feedback states.
* **Teacher Strength/Weakness Matrix:** High-density hairline grid (`1px` borders) displaying students × concepts with `tabular-nums` mastery percentages and 5-point grade badges (`2–5`).
* **Socratic AI Tutor Drawer:** Slide-over panel (desktop) or bottom sheet (mobile) referencing the current unit's page number (`42-б.`) and student interest tags without obscuring the active textbook paragraph.
* **Lesson Studio Rail (`LessonStudioRail`):** Rendered inside `[data-surface="rail"]` (where `--focus-ring` switches to `--text-on-rail` `#F5F1E8` for `≥3:1` contrast against cobalt), combining a `New lesson` action, numbered `JetBrains Mono` `1–3` workflow stage jumps (`Setup & unit`, `Plan review`, `Teaching studio`), saved lesson rows (`38px` min-height, `44px` on coarse pointers) with tabular durations (`45 min · 6 slides · 4 Qs`), and `Sample` outline badges.
* **16:9 Classroom Projection Plate & Presenter (`LessonSlidesPanel`, `TeachPresenterModal`):** Sharp `sm:aspect-video` `--bg-surface` plate (`border border-[var(--border-hairline)] border-t-4 border-t-[var(--accent-primary)]`, `24px–40px` padding) with a `JetBrains Mono` slide-and-page header (`Slide 1 / 6 · Textbook стр. 42`), `65ch` numbered bullets using `--accent-ink`, monospace formula callouts on `--bg-canvas`, and `.oku-stage-enter` plate motion. `TeachPresenterModal` frames the plate between a cobalt header (`border-b-4 border-[var(--accent-primary)]`) with a live `MM:SS` tabular timer and speaker-cue toggle, and a bottom arrow-key pager.
* **Scannable Classroom QR Plate (`QrMatrix`):** Crisp-edge (`shapeRendering="crispEdges"`) ISO/IEC 18004 SVG QR code locked to daylight paper (`#FFFDF9`) and night-slate modules (`#12161C`) inside a `4px`-radius `1px` hairline frame (`p-2`) so phone cameras scan reliably off a projector in both Light and Dark themes.
* **5-Point Grade Pill (`GradePill`):** Outlined `4px`-radius `JetBrains Mono` badge (`px-2 py-0.5`, `12px`, `600` weight, `tabular-nums`) binding both text and `1px` border to `--grade-five` through `--grade-two` (`Grade 5 · Excellent` down to `Grade 2 · Needs review`).
* **Student Kahoot Quiz Runner (`/play/[shareCode]`):** Zero-auth mobile-first runner with a compact cobalt header (`border-b-4 border-[var(--accent-primary)]`) + live tabular points badge, a `8px`-tall linear vermilion countdown bar (`bg-[var(--accent-primary)]`), a `2×2` (`sm:grid-cols-2`) grid of `76px`-min-height `4px`-radius choice buttons (`--choice-a`..`--choice-d`, `--on-choice` ink, `ChoiceShapeMark` icon; reveal state outlines the correct answer in `2px` `--text-primary` and dims unpicked wrong tiles to `opacity-40`), instant post-answer explanation card, and a 5-point `GradePill` summary + class leaderboard.

---

## Do's and Don'ts

* **Do** ensure every new component defines explicit Light and Dark theme CSS variables and passes WCAG AA contrast (`≥4.5:1` for body text).
* **Do** test all headings, badges, and buttons with Kyrgyz Cyrillic characters (`Ө, ө, Ү, ү, Ң, ң`) to prevent clipping or font fallback mismatches.
* **Do** keep textbook unit payloads lightweight (`<300KB`, WebP maps, inline SVG).
* **Do** keep `QrMatrix` locked to `#FFFDF9` paper and `#12161C` modules across both themes so projected classroom QR codes never invert and fail camera scanning.
* **Do** gate stage and drawer animations behind `prefers-reduced-motion` (`.oku-stage-enter`, `motion-reduce:open:animate-none`) and preserve `44px` minimum touch targets on coarse pointers (`coarse:min-h-[44px]`).
* **Don't** use generic pure `#FFFFFF` + `#2563EB` SaaS styling or heavy drop shadows.
* **Don't** hide original textbook page numbers (`page_break`); teachers and students rely on them for classroom alignment.
* **Don't** repurpose `--grade-five` through `--grade-two` for generic UI status badges or render Kahoot answer tiles without their paired `ChoiceShapeMark` geometry.
