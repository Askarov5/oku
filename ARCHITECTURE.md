# Software Architecture Document (SAD)

**Project:** Centralized Curriculum Education Platform  
**PRD Reference:** [MASTER_PRD.md](./MASTER_PRD.md) (v1.3)  
**Target Launch:** Kyrgyzstan — Grade 9 Algebra (Kyrgyz & Russian)  
**Status:** Architecture Blueprint v1.2 (MVP-Ready)  

---

## 1. Architectural Principles

1. **Canonical Content Once, Multi-Country Forever:** Separate universal concepts (`canonical_concept_id`) and declarative `CountryConfig` from localized textbooks, grading scales, and student PII.
2. **Low-Bandwidth & Mobile-First:** Optimize for budget Android phones on 3G/4G (KaTeX SSR, WebP diagrams on Cloudflare R2, <300KB unit payloads, PWA offline caching).
3. **First-Party Materials in MVP:** Ship only curated, platform-authored interactive materials in v1; defer untrusted user-submitted HTML/JS sandboxing to v2+.
4. **Event-Sourced Learning Telemetry:** All reading, quiz, interactive, and AI tutor interactions emit immutable `LearningEvents` that power live dashboards, author royalties, and v2+ counseling.
5. **PII vs. Content Decoupling:** Keep global curriculum/materials logically separated from student/school PII to support future in-country data residency requirements.

---

## 2. System Context & High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                            Client Layer (PWA)                             │
│  • Next.js Web App (Student Reader, Teacher Studio, Parent Portal)        │
│  • MathLive Keypad + KaTeX SSR + First-Party Interactive Visualizers      │
│  • IndexedDB Offline Cache + Background Sync                              │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ HTTPS / REST / SSE
┌───────────────▼───────────────────────────────────────────────────────────┐
│                         Edge & CDN (Cloudflare)                           │
│  • WAF, Rate Limiting, TLS                                                │
│  • Cloudflare R2: Textbook WebP Images & Source PDFs                      │
└───────────────┬───────────────────────────────────────────────────────────┘
                │
        ┌───────▼────────┐   HTTP / DB    ┌──────────────────────┐
        │   Vercel /     │   Job Table    │   Railway / Fly.io   │
        │  Core API (TS) ├───────────────►│  AI & OCR Worker     │
        │  Next.js +     │                │  (Python / FastAPI)  │
        │  Drizzle ORM   │                │  • MinerU / Docling  │
        └───────┬────────┘                │  • LiteLLM + SymPy   │
                │                         └──────────┬───────────┘
                │                                    │
        ┌───────▼────────────────────────────────────▼───────────┐
        │              PostgreSQL 16 + pgvector                  │
        │  • CountryConfig, Curriculum Graph, Unit JSON          │
        │  • Users, Classes, Quizzes, First-Party Materials      │
        │  • LearningEvents, Mastery, Author Usage Metering      │
        └────────────────────────────────────────────────────────┘
```
*(Upstash Redis added in Phase 7 for AI Tutor rate-limiting & response caching.)*

---

## 3. Monorepo Structure (Turborepo + pnpm)

```text
/
├── apps/
│   └── web/                  # Next.js (App Router) — Student, Teacher, Parent, Admin UI + Core API
├── services/
│   └── ai-worker/            # Python (FastAPI) — PDF/OCR ingestion, SymPy grading, Quiz Gen, RAG AI Tutor
├── packages/
│   ├── db/                   # Drizzle ORM schema, migrations, CountryConfig seeders
│   ├── shared-types/         # Shared TypeScript interfaces (Unit AST, LearningEvent, API DTOs)
│   └── ui/                   # Shared Tailwind/React components (KaTeX, MathLive, Block AST viewer)
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 4. Core Data Model (PostgreSQL + `pgvector`)

### 4.1 Multi-Country & Curriculum Graph

* **`countries`**
  * `code` (PK, e.g., `'kg'`, `'kz'`, `'uz'`)
  * `config` (JSONB): `{ languages: ['ky', 'ru'], gradeRange: [1, 11], calendar: '4_quarters', gradingScale: { type: '5_point', thresholds: [...] }, nationalExam: 'ORT' }`
* **`canonical_concepts`**
  * `id` (PK, e.g., `'math.algebra.quadratic_equations'`)
  * `subject` (`'algebra'`), `parent_id`, `labels` (JSONB: `{ ky: '...', ru: '...', en: '...' }`)
* **`books`**
  * `id` (UUID PK), `country_code` (FK), `grade` (`9`), `subject` (`'algebra'`), `language` (`'ky' | 'ru'`)
  * `is_canonical` (bool), `school_id` (nullable FK for custom school books)
  * `author_name`, `royalty_tier`, `status` (`'draft' | 'review' | 'published'`)
* **`book_pages`** (Idempotent PDF ingestion checkpointing)
  * `id` (UUID PK), `book_id` (FK), `page_number`, `raw_image_url`, `extracted_json` (JSONB), `status` (`'pending' | 'extracted' | 'reviewed' | 'failed'`)
  * Allows retrying failed pages individually without overwriting human-reviewed pages.
* **`app_settings`** (settings an admin changes while the app runs)
  * `key` (PK), `value` (JSONB), `updated_at`
  * `extraction_model`: the LiteLLM id of the model that reads pages (e.g. `gemini/gemini-3.6-flash`, or `openai/…` / `anthropic/…` when that provider's API key is set). Set in the admin library; the AI worker reads it at the start of each extraction job and records it on every page it extracts.
* **`units`** (= 1 Class / Lesson)
  * `id` (UUID PK), `book_id` (FK), `quarter` (`1..4`), `order_index`
  * `header` (JSONB — `title`, page range and printed page labels), `body` (JSONB — Markdown blocks, components, and page anchors), `learning_objectives` (JSONB)
* **`unit_concepts`** (M:N join: `unit_id`, `concept_id`)
* **`unit_chunks`** (for RAG AI Tutor)
  * `id` (UUID PK), `unit_id` (FK), `country_code`, `language`, `block_id`, `content_text`, `embedding` (`vector(1536)`)

### 4.2 Users, Schools & Classes

* **`schools`**: `id`, `country_code`, `name`, `plan` (`'free' | 'b2b'`), `seat_limit`
* **`users`**: `id`, `role` (`'student' | 'teacher' | 'parent' | 'creator' | 'admin'`), `email` (nullable), `phone` (nullable), `telegram_id` (nullable), `preferred_lang` (`'ky' | 'ru'`), `interests` (`text[]`, e.g., `['football', 'gaming']`), `subscription_tier` (`'free' | 'pro'`)
* **`parent_student_links`**: `parent_id`, `student_id`, `verified_at`
* **`classes`**: `id`, `school_id` (nullable), `teacher_id`, `country_code`, `grade`, `subject`, `join_code`, `base_book_id`
* **`syllabi`**: Lightweight overlay/diff on canonical `units` (`hidden_unit_ids`, `unit_order`, `injected_blocks_after_id`) so canonical typo/formula fixes propagate automatically to forked school classes.
* **`class_enrollments`**: `class_id`, `student_id`, `enrolled_at`

### 4.3 Assessments & First-Party Teaching Materials

* **`quizzes`** & **`questions`**: Linked to `unit_id` and `concept_id`. `question_type` (`'mcq' | 'numeric' | 'algebraic' | 'matching' | 'fill_blank'`), `prompt_md` (Markdown + LaTeX), `answer_key` (JSONB), `hints` (JSONB).
* **`learning_materials`** (Curated First-Party Interactive Components & Teacher Notes):
  * `id`, `unit_id`, `concept_id`, `type` (`'interactive_visualizer' | 'worked_example' | 'teacher_note' | 'curated_link'`)
  * `component_key` (e.g., `'quadratic_grapher'`), `config` (JSONB), `title`

### 4.4 Enriched Learning Telemetry, Mastery & Author Royalties

* **`learning_events`** (Append-only indexed table; defer monthly partitioning until scale requires it)
  * `id`, `student_id`, `class_id` (nullable for self-study), `country_code`, `book_id`, `unit_id`, `concept_id`
  * `event_type`: `'unit_read' | 'quiz_submitted' | 'widget_completed' | 'tutor_session'`
  * `score` (`0.0–1.0`, nullable), `duration_sec`, `metadata` (JSONB), `created_at`
  * **Required `metadata` per event:**
    * `unit_read`: `{ active_time_sec, scroll_depth_pct, blocks_viewed_count, revisit_after_failure }`
    * `tutor_session`: `{ intent_type: 'concept_confusion' | 'exercise_hint' | 'curiosity_deep_dive', hints_needed_to_solve, analogy_topic, post_tutor_outcome }`
    * `widget_completed`: `{ modality: 'interactive_widget', interactions_count, completed }`
* **`quiz_attempt_items`** (Granular question-level diagnostics)
  * `id`, `attempt_id`, `student_id`, `question_id`, `concept_id`
  * `is_correct`, `attempt_number`, `time_spent_sec`, `hints_used`, `skipped`, `error_category` (`'conceptual' | 'careless' | 'incomplete'`, nullable)
  * Enables distinguishing conceptual gaps from rushing or careless arithmetic errors.
* **`student_concept_mastery`** (Materialized/updated state per `(student_id, concept_id)`)
  * `student_id`, `concept_id`, `mastery_score` (`0.0–1.0`, recency-weighted), `confidence` (`'low' | 'medium' | 'high'`)
  * `attempts_count`, `avg_time_per_question_sec`, `preferred_modality` (`'text' | 'widget' | 'tutor'`, derived from score lift)
  * `last_practiced_at`, `retention_state` (`'fresh' | 'due_for_review' | 'decayed'`)
* **`book_usage_daily`** (Materialized/aggregated daily)
  * `date`, `book_id`, `unique_students_count`, `unit_reads_count` → feeds monthly author royalty statements.

### 4.5 Product Analytics vs. First-Party Learning Telemetry (PostHog Boundary)

* **First-Party PostgreSQL (Source of Truth):** All `learning_events`, `quiz_attempt_items`, `student_concept_mastery`, and `book_usage_daily` are written directly via `POST /api/events/batch` (ad-blocker immune, offline-sync compatible, RBAC-protected, and data-residency compliant).
* **PostHog (Product & UX Analytics Only):** Used strictly for onboarding funnels, feature adoption, A/B tests, and UI performance using **pseudonymous `user_id`s only**. Never send student PII, quiz answers, grades, or psychological data to PostHog.

---

## 5. Key Subsystem Designs

### 5.1 Textbook Ingestion Pipeline (`services/ai-worker`)

```text
PDF Upload ──► Page Rasterizer (200 DPI PNG)
                 ├──► MinerU / Docling: Detect layout & crop diagrams ──► WebP (R2)
                 └──► LiteLLM (Gemini vision model chosen in the admin):
                        • Transcribe Kyrgyz (Ө,Ү,Ң) + Russian + $LaTeX$
                        • Generate `ai_description` for each cropped diagram
                        • Structure into Unit Block AST JSON + initial Quiz Bank
                                  │
                                  ▼
                       Admin Review UI (fix any OCR/LaTeX) ──► Publish + Embed to pgvector
```

* **Content Schema (`packages/shared-types`):** Content is continuous Markdown interrupted only by components.
  * **Page JSON** (`book_pages.extracted_json`): `printedPage` (number printed on the page, or `null`), `continuesFromPrevious` (the first text continues a paragraph from the previous page), and `blocks` of type `markdown` (`{ markdown }`; headings, lists, and tables stay inside it), `image` (`url`, `alt`, `ai_description`, `caption`, `bbox`; kept in reading order), or `unit_header` (`{ title }`; a new unit starts here).
  * **Unit** (`units.header` + `units.body`): the header holds `title`, `pageStart`, `pageEnd` and their printed labels. The body holds `markdown`, `image`, and `page_anchor` (`{ id: 'page-42', pageNumber, label, midParagraph }`), which marks where a page starts and is rendered as a subtle rule + page label, or inline when `midParagraph` is true, for classroom alignment, go-to-page, and exact AI Tutor page citations.
  * Ingestion emits only `markdown`, `image`, and `unit_header`. Authored components (`callout`, `exercise`, `material_anchor`, first-party interactive components) are added later and never by auto-digitisation.
  * `buildUnits` joins reviewed pages into units at each `unit_header`; text before the first header goes under the book title. The admin derives the same outline live from page JSON, so contents and unit preview are available before publishing.
* **Math Rendering:** Server-rendered **KaTeX** (+ `mhchem`) so mobile clients receive pre-rendered math HTML+CSS with zero client-side layout shift.

### 5.2 Socratic AI Tutor & Cost Controls

* **Retrieval:** Query `unit_chunks` filtered strictly by `unit_id`, `country_code`, and `language` (hybrid vector + keyword search). Include `ai_description` of diagrams in the unit.
* **System Prompt Contract:**
  1. Answer **only** from the retrieved unit context (cite block/section).
  2. Adapt explanations/analogies to `user.interests` (e.g., football, music).
  3. **Socratic Rule:** If the student asks about an exercise/quiz problem, provide a hint, guiding question, or similar worked analogy—never reveal the final answer.
  4. Respond in `user.preferred_lang` (`ky` or `ru`).
* **Cost & Abuse Protection:**
  * Redis sliding-window rate limit + daily token/message quota for `free` tier (`pro` tier gets higher/unlimited cap).
  * Pre-generate & cache unit summaries and common concept analogies in Postgres/Redis to avoid redundant LLM calls.

### 5.3 First-Party Interactive Materials & Symbolic Math Grading (v1)

* **Built-In Visualizers:** Platform-authored React interactive components (e.g., quadratic/linear function grapher, factoring explorer) embedded directly in the Unit Reader. They emit `{ completed, score, timeSpentSec }` straight to `POST /api/events/batch` with zero cross-origin sandboxing overhead.
* **Algebraic Input & Grading:**
  * Students enter expressions using **MathLive (`<math-field>`)** mobile keypad.
  * `algebraic` questions are graded via **SymPy** in `services/ai-worker` (or Compute Engine) for symbolic equivalence (e.g., `(x-2)(x+2)` == `x^2 - 4`, `0.5` == `1/2`).

### 5.4 Offline-First PWA & Sync

* Service Worker caches app shell + KaTeX CSS/fonts.
* "Download Unit for Offline" stores the Unit Block JSON + WebP images + Unit Quiz in **IndexedDB**.
* Offline quiz submissions and `unit_read` events are queued in IndexedDB and flushed to `POST /api/events/batch` when connectivity returns.

---

## 6. Authentication, Security & Compliance

* **Auth:** Passwordless **Telegram Bot OTP** (free, instant) or **Email Magic Link/OTP** via Resend; short-lived JWT access token + `HttpOnly; Secure; SameSite=Lax` refresh cookie. *(WhatsApp/SMS OTP deferred to v2+.)*
* **RBAC:** Route-level middleware enforcing `student`, `teacher`, `parent`, and `admin` scopes (e.g., a parent can only read `learning_events` for verified `parent_student_links`).
* **Minor Privacy:** Parental consent flag required for under-16 accounts where applicable; zero third-party ad trackers.

---

## 7. v2+ Extension Points (Zero-Rewrite Readiness)

* **Community Interactive Widget Marketplace & Sandbox:** Serve user-submitted HTML/CSS/JS bundles from Cloudflare R2 on an isolated `widgets.<domain>` origin inside `<iframe sandbox="allow-scripts">` with strict CSP and a signed `postMessage` Widget SDK (`packages/widget-sdk`).
* **Live Classroom Mode (Kahoot-style):** Add a lightweight WebSocket service (`apps/realtime` using PartyKit/Socket.io) reading from the existing `questions` table and writing results to `learning_events`.
* **Psychometrics & AI College Counselor:** Add `psychometric_assessments` table; Counselor service reads longitudinal `learning_events` + `CountryConfig.nationalExam` (e.g., ORT, ENT) without altering v1 tables.
