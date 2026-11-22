---
target: book page admin library
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\AirPods\\Desktop\\git\\oku\\apps\\web\\src\\app\\admin\\library\\[bookId]\\page.tsx"
target_fingerprint: "sha256:f126064f72395bc8157f748b0b56f81635e5d915d6e93f801edb5e9d66ceea80"
target_path: "C:\\Users\\AirPods\\Desktop\\git\\oku\\apps\\web\\src\\app\\admin\\library\\[bookId]\\page.tsx"
timestamp: 2026-11-22T19-35-47Z
slug: apps-web-src-app-admin-library-bookid-page-tsx
---
# Book page critique

Method: dual-agent (A: 158872a1-e0f5-4bef-b0e4-d0eb05422672 · B: c5839dea-1889-4c49-878b-4c6f9829c3b8)

Target: apps/web/src/app/admin/library/[bookId]/page.tsx
Live: http://localhost:3000/admin/library/70dd03cf-d0be-47f6-a3a5-adaf9c0cfd0c

## Design health

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Publish disabled with the reason only in a count below the job log |
| 2 | Match system / real world | 2 | KY · political_geography and extracted beside a Kyrgyz textbook |
| 3 | User control and freedom | 2 | Publish has no confirm and no stated gate |
| 4 | Consistency and standards | 3 | Shared controls; review / reviewed / completed are three words |
| 5 | Error prevention | 1 | Retry failed is offered when failed is 0; Retry on every extracted page |
| 6 | Recognition rather than recall | 2 | extracted means not reviewed yet, and the admin must remember that |
| 7 | Flexibility and efficiency | 2 | No way to see only the pages that still need a person |
| 8 | Aesthetic and minimalist design | 2 | 21 finished jobs and 256 Retry buttons lead the page |
| 9 | Error recovery | 2 | Load failure is a sentence with no retry |
| 10 | Help and documentation | 1 | Nothing says why Publish is dead |
| **Total** | | **19/40** | **Acceptable** |

## Audit health

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Admin token field had no name |
| 2 | Performance | 3 | Header cover was lazy |
| 3 | Theming | 3 | Tokens hold; drawer scrim is a raw rgb |
| 4 | Responsive | 3 | No overflow at 390px; fine-pointer Retry was 38px |
| 5 | Implementation integrity | 4 | Page scan clean; cream and side-tab hits are the canvas and the rail rule |
| **Total** | | **16/20** | **Good** |

## Specificity

The atlas frame is authored for oku. The operate task was an interchangeable ingestion queue: twenty-one rows of "failed 0" and a Retry on every page that had already extracted.

Detector: page markup clean (exit 0). Live overlay flagged the parchment canvas `#F5F1E8`, a false positive for the committed light theme. `border-r-4` on the rail is the 4px vermilion rule, a false positive.

## Priority issues as found

- P0 Publish disabled with no reason on the control.
- P1 Retry is the loud control on pages that only need a person.
- P1 The ingestion log lists every finished job and offers Retry failed at 0.
- P1 Kyrgyz titles were clamped in the rail; the header spoke political_geography.
- P2 Load failure had no retry, and publish posted with no confirm.

## Same-pass changes

The book page now states "20 of 276 pages reviewed" on the disabled Publish control, asks for a confirm before publishing, lists only jobs that are still running or have failures, defaults the index to Needs review, and keeps Retry for failed pages. Status words are In review, Needs review, Reviewed, Failed. The subject reads Political geography. Rail titles wrap in the book language. The admin token field has a label. The header cover loads immediately.
