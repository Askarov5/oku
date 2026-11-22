---
target: library
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\AirPods\\Desktop\\git\\oku\\apps\\web\\src\\app\\admin\\library"
timestamp: 2026-11-21T19-08-28Z
slug: apps-web-src-app-admin-library
---
Method: dual-agent (A: d30f3b1e-6a6c-42ed-8fa0-6be591029eaa · B: b58b6dc6-2080-4eb6-bbdd-eac8003e38ba)

A newer Impeccable (v4.10.0) is available. Update now? It runs `npx impeccable update`.

# Library design critique

The Digital Library is a generic ingestion console wearing the atlas palette. Parchment, cobalt, and vermilion are present. The 260px rail, the vermilion rule, and classroom page numbers (`1-б.` / `стр. 1`) are not. Night mode currently hides the title.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Status pills and job counters exist, but night mode hides “Digital Library”, upload errors use caption gray, and a disabled Publish never says why. |
| 2 | Match System / Real World | 2 | Links say “p.1”, metadata says “political_geography”, and block labels say “HEADING · H1”. A teacher expects `1-б.` / `стр. 1`. |
| 3 | User Control and Freedom | 2 | Back links work. There is no undo, no unpublish, no confirm on Publish, and no previous/next page. |
| 4 | Consistency and Standards | 2 | Cards and vermilion primaries match. The header paints text with `--bg-canvas`, so night mode inverts the title. Status greens reuse the grade scale. |
| 5 | Error Prevention | 1 | Publish stays enabled on a book already marked published. “Retry failed” stays enabled when failed is 0. |
| 6 | Recognition Rather Than Recall | 2 | Status words are on the pills, but a library row has no reviewed count, so the admin must remember what is left. |
| 7 | Flexibility and Efficiency | 1 | No next/previous, no jump to failed pages, no filter, no shortcuts. Each page is a separate trip. |
| 8 | Aesthetic and Minimalist Design | 2 | Parchment and hairlines are quiet. The always-open upload form, snake_case metadata, and pipe-markdown tables are schema leftover. |
| 9 | Error Recovery | 2 | “Invalid admin token” is red and per-page Retry exists. A failed library load returns silently. |
| 10 | Help and Documentation | 1 | The only guidance is the admin-token sentence and “No books yet.” |
| **Total** | | **17/40** | **Poor** |

## Design Specificity Verdict

**LLM assessment.** Category-interchangeable admin with the atlas palette applied. Daylight tokens are real: parchment `#F5F1E8`, paper cards, cobalt `#1D3557`, vermilion `#C84B31`, 4px corners, Golos Text, no card shadows. Kyrgyz **Ө Ү ө** render in the editor. Swap the tokens and this could be any PDF tool. DESIGN.md’s fixed 260px cobalt rail and 4px vermilion vertical rule are absent; `ThemeShell` is a full-width bar. Page links are “p.1”. The editor drops every `page_break`, so the hairline marker `1-б. / стр. 1` never appears. Chrome is English (`lang="en"`), including “Phase 1 ADMIN_TOKEN” and “HEADING · H1”.

**Deterministic scan.** The CLI detector over the library routes, admin gate, page editor, admin layout, and `packages/ui/src` exited 0 with `[]`. It cannot see computed contrast from CSS variables. The browser detector, injected on the library, the sample book, and page 1, is the evidence that matters:

- `low-contrast` 1.2:1, `#1f2937` on `#1d3557`, the Day/Night button. Agrees with the night/day title failure.
- `low-contrast` 2.7:1, vermilion `#c84b31` on cobalt `#1d3557`, the “oku” kicker. Agrees; the LLM had measured about 2.65:1.
- `low-contrast` 2.3:1 on placeholders “1” and “all” (`#9ca3af` on `#f5f1e8`). The review named the “all” placeholder; it missed that the placeholder color itself fails AA.
- `low-contrast` 4.4:1, grade green `#15803d` on parchment, the status pill. Borderline and reserved by DESIGN.md for the 5-point scale.
- `first-viewport-column-overflow`: the review grid’s image column is 143% of the viewport. Agrees with the scan scrolling away from the text.
- `nested-cards`: four identical “card inside card” hits on the review page. Treat as one nesting, not four defects.
- `cream-palette` on `#F5F1E8`: false positive. DESIGN.md pins parchment.
- `kicker-above-heading` (“oku” over “Digital Library”): false positive as a pattern. The kicker is the shell’s brand line. Its contrast is the real defect, already counted under `low-contrast`.

**Visual overlays.** Injection succeeded in the [Human] tab on all three views. The live server on port 8400 was stopped afterward. Cleanup could not remove the script tag (`config_missing` under `apps/web/.impeccable/live/config.json`), so highlights from that run may still be on the tab. New injection will not work until the server is started again.

## Overall Impression

The review pane is the one screen that understands the job: the scan on the left, the Kyrgyz blocks on the right, Save beside Mark reviewed. Everything around it is an operator log. The single biggest opportunity is to make a textbook page identifiable as a textbook page, in a shell that stays readable in both themes.

## What's Working

- Daylight tokens are actually in the UI: parchment canvas, paper cards, hairline borders, vermilion primary, cobalt bar, Golos, no drop shadows.
- Side-by-side review is the right task shape. “Page image” next to “Extracted blocks” is a clear commit step, and the sample WebP loads.
- Ingestion state is modeled. Job counters, reviewed pills, and Retry on failed or extracted pages give an operator something to look at. Kyrgyz special letters are not clipped in the fields that hold them.

## Priority Issues

### [P0] Night mode hides “Digital Library”, and the theme control fails in daylight

**Why it matters:** `theme-shell.tsx` sets header text to `--bg-canvas`. In the dark theme that is `#12161C` on rail `#152843`, about 1.22:1. The detector measured the theme button at 1.2:1 (`#1f2937` on `#1d3557`) because the ghost button’s `text-primary` wins over the header color. The theme switch is the control that produces the unreadable state.

**Fix:** Add `--text-on-rail: #F5F1E8` for both themes and use it on the title, the “oku” kicker, and the theme button. Bump the kicker off vermilion-on-cobalt (2.7:1) onto that same light ink, and keep vermilion for the 4px rule.

**Suggested command:** `/impeccable colorize`

### [P1] Keyboard users cannot see focus

**Why it matters:** A focused field computes to `outline-style: none` and `box-shadow: none`. The border stays the hairline. Save, Mark reviewed, and the Kyrgyz fields give no location. The gate’s only name is the placeholder “ADMIN_TOKEN”.

**Fix:** Add a 2px vermilion `focus-visible` ring on buttons and inputs. Give the token field a visible label. Set `aria-pressed` on the theme toggle.

**Suggested command:** `/impeccable audit`

### [P1] Textbook pages are labeled like debug indexes

**Why it matters:** Teachers say “open 42-б.” The grid says “p.1”. The review title says “Review page 1”. `page-review-editor.tsx` filters out every `page_break`, so the hairline and the JetBrains marker never render. `lang="en"` wraps Kyrgyz.

**Fix:** Render `page_break` as the hairline plus a tabular marker from the book language (`1-б.` for Kyrgyz, `стр. 1` for Russian). Use that string on the grid link and the review title. Set `lang` from the book on the editor.

**Suggested command:** `/impeccable typeset`

### [P1] The atlas rail is missing, so the product never arrives

**Why it matters:** DESIGN.md’s desktop shell is a fixed 260px cobalt rail with a 4px vermilion vertical rule. This surface is a 77px bar and a centered `max-w-6xl` column. At 390px the title and Night share one cramped strip, and the primary actions sit at the top, out of thumb reach.

**Fix:** Build the rail for ≥1024px and collapse it to a top bar plus drawer below that. Let the review workspace go fluid. Put Publish and Mark reviewed within the working column, not only in the header.

**Suggested command:** `/impeccable layout`

### [P2] Review and publish do not protect a canonical text

**Why it matters:** The image column runs 143% of the viewport, so the scan leaves while you edit. Tables stay pipe-markdown in JetBrains Mono, including the prose being proofread. Publish stays vermilion beside a “published” pill and produced two units with the same title, “Саясий география”. “Retry failed” is offered when failed is 0. A library card shows “KY · grade 9 · political_geography”, not “2/2 reviewed”.

**Fix:** Sticky the page plate. Set prose fields to Golos and render tables as tables. Add previous/next. Hide “Retry failed” when `failedPages` is 0. After publish, replace the button with a completed state. Show the reviewed count on the library card.

**Suggested command:** `/impeccable harden`

## Cognitive load

7 of 8 checks fail. Grouping passes: Library vs Upload, and Jobs vs Pages vs Units, are separate cards. Single focus, chunking, hierarchy, one-thing-at-a-time, minimal choices, working memory, and progressive disclosure fail. The catalog and the full upload form share one screen. The upload form is open by default, including page range. The book page offers Retry and Publish on a book that is already published. High cognitive load.

## Emotional journey

The gate feels like a deploy console. The empty library is calm, then the form asks for “Kyrgyz (ky)” and a page end whose placeholder is “all”. The wait is a log line that refreshes every 4 seconds without saying so. Review is the human moment, until “HEADING · H1” and a textarea of `| Өлкө | Борбор |` make proofreading feel like editing an export. Publish ends on two identical unit titles. There is no sense that a canonical text just became a class.

## Persona Red Flags

**Alex (power user).** No previous/next on “Review page 1”. No failed-only filter. “Retry failed” is live on a job that reads “failed 0”. The library row has no page progress, so a 200-page book is a wall of “p.N”. Publish does not explain itself when disabled, and does not step aside when the pill already says “published”.

**Sam (keyboard / screen reader).** The token field’s accessible name is the placeholder “ADMIN_TOKEN”. `lang="en"` wraps Kyrgyz. “HEADING · H1” is a paragraph, so the heading field is named only “Саясий география”. Focus rings are absent. The night-mode `<h1>` is about 1.2:1. “Night” / “Day” has no `aria-pressed`. Status is color plus a word, which is acceptable, but the green is also the grade-5 color.

**Riley (empty, failed, long Kyrgyz).** “No books yet. Upload a PDF to start ingestion.” is clear. A library fetch that is not ok vanishes with no message. Upload and book errors use the same gray as hints. A long title already wraps to “Grade 9 Political / Geography Sample”, and `political_geography` breaks onto its own line. The Kyrgyz paragraph is a 14px mono box that clips mid-sentence. The two published units cannot be told apart.

## Minor Observations

- “Upload & queue” on `#C84B31` is about 4.6:1. It passes as large text and is not comfortable.
- The gate card is `max-w-md` and left-aligned, so daylight is mostly empty margin.
- Status text is the raw enum: “published”, “completed”, “reviewed”.
- Polling every 4 seconds never says that it is polling.
- The page plate has no vermilion top rule.
- The file input is the browser’s default control.

## Questions to Consider

- A teacher says “open 42-б.” Which control on this screen answers them?
- If night mode is the atlas plate, why is that the theme that erases “Digital Library”?
- What would have to change for “Mark reviewed” to feel like signing a textbook page instead of saving a block export?
