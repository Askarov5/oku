---
version: 1
slug: "src-app-lessons-page-tsx"
primary_target: "src/app/lessons/page.tsx"
related_targets: ["src/app/play/[shareCode]/page.tsx"]
---

# Lesson Studio & Kahoot Quiz Flow

- **Mode:** Operate (Teacher Studio & Student Quiz Runner)
- **Audience & Job:** Zero-auth workspace for school teachers preparing a 45-minute lesson from a canonical digitized textbook unit plus optional teacher-uploaded slides/images and custom teaching angles (e.g., soccer free-kick physics), culminating in a classroom presentation view and a shareable, auto-graded Kahoot-style student quiz on the 5-point scale (2–5).

## Direction contract

THESIS: A two-stage teacher studio anchored to canonical textbook units and printed page markers (`42-б. / стр. 42`) where teachers review and shape the core lesson plan before generating synchronized slides, homework, and a shareable Kahoot-style quiz—refusing generic one-shot prompt boxes and nested SaaS card walls.

OWN-WORLD: Inherits oku's Central Asian Cartographic Atlas system (`DESIGN.md`): warm uncoated parchment (`--bg-canvas`) and bright atlas paper (`--bg-surface`) in Daylight mode, charcoal-slate (`#12161C`) and plate (`#1A2029`) in Night mode, anchored by the `260px` Prussian-cobalt rail with its `4px` vermilion rule, `Golos Text` prose, `JetBrains Mono` tabular durations/grades, `1px` hairline divides, `4px` crisp corners, zero drop shadows, and zero kickers above headings.

STORY: A teacher picks a textbook and unit, sees the audience auto-filled from the book's grade, sets lesson count (`1`), duration (`45 min`), and a creative angle (such as explaining kinetic energy via soccer free kicks), reviews and edits the timed lesson plan first, generates checked deliverables (`Slides`, `Kahoot Test`, `Homework`), mixes in uploaded images/slides, teaches in full-screen Classroom Presenter mode, and ends on a QR/link quiz card that students play on mobile without auth while live 2–5 grades populate the leaderboard.

FIRST VIEWPORT: Fixed `260px` Prussian-cobalt Lesson Studio rail on the left listing saved lessons and quick stage jumps; fluid workspace on the right split on desktop (`1fr` + `360px`) between the Book & Unit source selector, creative angle prompt, and upload dropzone on the left, and the auto-filled Audience, lesson count (`1`), `45 min` duration, deliverable checkboxes, and primary vermilion `Generate lesson plan` button on the right.

FORM: Two-stage editorial-cartographic studio + 16:9 classroom projection stage + mobile-first geometric-symbol Kahoot quiz runner (#1 grounded form inside the established world, `seed:fefcb744958d6bf6`).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
