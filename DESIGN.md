---
name: oku
description: Central Asian Cartographic Atlas — a dual-theme (light & dark) editorial-learning design system for Kyrgyzstan Grade 9+ education.
colors:
  atlas-parchment: "#F5F1E8"
  atlas-paper: "#FFFDF9"
  atlas-border: "#D6CFC2"
  atlas-ink: "#1F2937"
  atlas-ink-muted: "#57534E"
  prussian-cobalt: "#1D3557"
  prussian-cobalt-deep: "#152843"
  vermilion-accent: "#C84B31"
  vermilion-hover: "#B03E26"
  night-slate: "#12161C"
  night-plate: "#1A2029"
  night-border: "#2B3442"
  night-ink: "#F5F1E8"
  night-ink-muted: "#9CA3AF"
  night-cobalt: "#2A4A7F"
  night-vermilion: "#E05D44"
  grade-five: "#15803D"
  grade-four: "#0F766E"
  grade-three: "#B45309"
  grade-two: "#B91C1C"
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
| `--bg-rail` | `#1D3557` (`prussian-cobalt`) | `#152843` (`prussian-cobalt-deep`) | Persistent quarter/unit navigation rail |
| `--border-hairline` | `#D6CFC2` (`atlas-border`) | `#2B3442` (`night-border`) | Card borders, matrix gridlines, `<hr>` page breaks |
| `--text-primary` | `#1F2937` (`atlas-ink`) | `#F5F1E8` (`night-ink`) | Body copy, headings, table values |
| `--text-secondary` | `#57534E` (`atlas-ink-muted`) | `#9CA3AF` (`night-ink-muted`) | Captions, metadata, timestamps |
| `--accent-primary` | `#C84B31` (`vermilion-accent`) | `#E05D44` (`night-vermilion`) | Active unit highlight, primary CTAs, map pins |
| `--accent-secondary` | `#1D3557` (`prussian-cobalt`) | `#2A4A7F` (`night-cobalt`) | Secondary buttons, interactive map fills |

### Mastery & 5-Point Grade State Colors

State colors are reserved strictly for assessment feedback, mastery heatmaps, and the 5-point grading scale (`2–5`):

* **Grade 5 (`90–100%`):** `#15803D` (Light) / `#22C55E` (Dark)
* **Grade 4 (`75–89%`):** `#0F766E` (Light) / `#2DD4BF` (Dark)
* **Grade 3 (`60–74%`):** `#B45309` (Light) / `#F59E0B` (Dark)
* **Grade 2 (`<60%`):** `#B91C1C` (Light) / `#EF4444` (Dark)

---

## Typography

* **Primary UI & Reading Face:** `Golos Text` (with `system-ui, sans-serif` fallback) — chosen specifically for clean, balanced **Kyrgyz (`Ө, ө, Ү, ү, Ң, ң`)** and **Russian** Cyrillic proportions at both display and 16px reading sizes.
* **Tabular & Metadata Face:** `JetBrains Mono` — used with `font-variant-numeric: tabular-nums` for 5-point grades, mastery percentages, running times (`45 мин`), and textbook page markers (`42-б. / стр. 42`).
* **Reading Measure:** Textbook prose is capped at `65ch` max width with `1.65` line-height for comfortable long-form mobile and desktop reading.

---

## Layout

* **Desktop (`≥1024px`):** Two-column shell featuring a fixed `260px` Prussian-cobalt navigation rail (anchored by a `4px` vermilion vertical border rule) and a fluid reading/analytics workspace (`32px 44px` padding).
* **Tablet & Mobile (`<1024px`, budget Android priority):** The `260px` rail collapses into a compact top bar showing the active Quarter & Unit title plus a slide-over syllabus drawer and thumb-friendly bottom pagination (`Previous` / `Next Unit` / `Ask AI Tutor`).
* **Spacing Rhythm:** Base `8px` scale (`4px`, `8px`, `16px`, `24px`, `32px`, `44px`).

---

## Elevation & Depth

* **Flat Tonal Layering:** Avoid heavy drop shadows (`box-shadow` is omitted on cards to keep low-end Android rendering fast and crisp).
* **Hierarchy via Surface & Rule:** Separate layers using background tone shifts (`--bg-canvas` vs. `--bg-surface`), `1px solid var(--border-hairline)` borders, and `4px` vermilion top/left accent rules on featured map plates or active navigation items.

---

## Shapes

* **Crisp Cartographic Corners:** Use `4px` (`--rounded-xs`) for textbook plates, buttons, and matrix cells, and `6px–8px` for modal/drawer containers. Avoid overly bubbly `20px+` radii.
* **Page Break Rule (`page_break`):** Rendered as a full-width `1px solid var(--border-hairline)` `<hr>` centered with a pill-shaped `JetBrains Mono` label (`42-б. / стр. 42`).

---

## Components

* **Quarter & Unit Rail:** Prussian-cobalt background (`--bg-rail`), vermilion active row (`#C84B31` with `#FFFFFF` text), and right-aligned tabular duration/completion indicator.
* **Block AST Reader Cards:** Uncoated paper (`--bg-surface`) with `1px` border; `callout` blocks (`example`, `definition`, `theorem`) use a `4px` left border in cobalt or vermilion.
* **Interactive TopoJSON Map Plate:** Always rendered inside a high-contrast dark-slate or crisp-bordered frame (`--bg-surface` with `4px` vermilion top rule) with clickable SVG country/region polygons, hover tooltips, and `map_pin` quiz feedback states.
* **Teacher Strength/Weakness Matrix:** High-density hairline grid (`1px` borders) displaying students × concepts with `tabular-nums` mastery percentages and 5-point grade badges (`2–5`).
* **Socratic AI Tutor Drawer:** Slide-over panel (desktop) or bottom sheet (mobile) referencing the current unit's page number (`42-б.`) and student interest tags without obscuring the active textbook paragraph.

---

## Do's and Don'ts

* **Do** ensure every new component defines explicit Light and Dark theme CSS variables and passes WCAG AA contrast (`≥4.5:1` for body text).
* **Do** test all headings, badges, and buttons with Kyrgyz Cyrillic characters (`Ө, ө, Ү, ү, Ң, ң`) to prevent clipping or font fallback mismatches.
* **Do** keep textbook unit payloads lightweight (`<300KB`, WebP maps, inline SVG).
* **Don't** use generic pure `#FFFFFF` + `#2563EB` SaaS styling or heavy drop shadows.
* **Don't** hide original textbook page numbers (`page_break`); teachers and students rely on them for classroom alignment.
