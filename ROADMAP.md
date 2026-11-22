# Implementation Roadmap (v1 MVP)

**Product:** Centralized Curriculum Education Platform  
**v1.0 Quick Start Wedge:** Kyrgyzstan — Grade 9 **Political Geography** (Kyrgyz & Russian)  
**v1.1 Fast Follow:** Kyrgyzstan — Grade 9 **Algebra** (+ KaTeX, MathLive, SymPy)  
**References:** [MASTER_PRD.md](./MASTER_PRD.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)  

---

## Phase 0: Repository & Infrastructure Foundation (Prerequisite)
**Goal:** Establish the monorepo, database, and object storage so Phase 1 has a working target.
* **Deliverables:**
  * Initialize Turborepo + `pnpm` workspace (`apps/web`, `services/ai-worker`, `packages/db`, `packages/shared-types`, `packages/ui`).
  * Provision PostgreSQL 16 + `pgvector` and Cloudflare R2 bucket.
  * Implement core Drizzle ORM schema (`countries`, `canonical_concepts`, `books`, `book_pages`, `units`, `unit_chunks`, `ingestion_jobs`) and seed `CountryConfig` for Kyrgyzstan (`kg`).
* **Exit Criteria:** `pnpm dev` runs `apps/web`, `services/ai-worker` healthcheck responds, and migrations apply cleanly.

---

## Phase 1: PDF → Digital Converter → Digital Library
**Goal:** Convert raw Grade 9 Political Geography PDFs (Kyrgyz & Russian) into clean, structured Unit JSON + WebP maps/diagrams.
* **Deliverables:**
  * Python ingestion worker (`services/ai-worker`): PDF rasterizer (200 DPI) + MinerU/Docling map/diagram cropping → WebP compression → Cloudflare R2 upload.
  * Hybrid Vision-LLM extractor (`LiteLLM` + Gemini 2.5 Flash) outputting page JSON (continuous `markdown` with `image` components in reading order, `unit_header` where a unit starts, and the printed page number) with Kyrgyz (`Ө, Ү, Ң`) + Russian text, tables, and map `ai_description`s.
  * **Admin Library & Review UI:** Upload PDF, track page-level `book_pages` status (`pending | extracted | reviewed | failed`) with per-page retry, inspect/edit Markdown side-by-side with original page image, and publish canonical books.
* **Exit Criteria:** At least 1 full Grade 9 Political Geography textbook (or 3–5 sample chapters in Kyrgyz & Russian) ingested, reviewed, and stored in `books` + `units` with >99% text/table accuracy.

---

## Phase 2: Reader UI & Syllabus Generator
**Goal:** Deliver a fast, mobile-first digital textbook reader and auto-generate quarter-based syllabi.
* **Deliverables:**
  * **Unit Reader UI (`packages/ui`):** Clean mobile-first reader that shows the book by unit (header, then Markdown body) with a table of contents and go-to-page, responsive WebP maps/diagrams, `page_anchor` markers (*42-б. / стр. 42*), authored callouts, dark/light mode, <300KB average payload. *(Add KaTeX SSR in v1.1 for Algebra.)*
  * **Offline PWA Support:** Service Worker + IndexedDB unit caching ("Download Unit for Offline").
  * **Syllabus Generator:** Auto-map book chapters into Units (= 1 Class) organized by the **4 academic quarters (четверть)**, tagged with `canonical_concept_id`.
  * **Custom Syllabus Forking:** Allow unique/private schools to fork a canonical syllabus via lightweight overlay/diff (`syllabi` hiding/reordering/injecting blocks) while keeping canonical bugfixes.
* **Exit Criteria:** A user can open any Grade 9 Geography unit on mobile/3G, read it offline, and view the generated 4-quarter syllabus.

---

## Phase 3: First-Party Teaching / Learning UI & Interactive Map Materials
**Goal:** Make lessons interactive with a built-in GeoPlayer-style Interactive Map visualizer and teacher-attached notes.
* **Deliverables:**
  * **Teaching/Learning Workspace:** Integrated view where teachers can attach custom notes, regional data tables, or first-party interactive components between textbook blocks.
  * **Built-In Interactive Map & Data Visualizers (`packages/ui`):** First-party React SVG/TopoJSON world & Central Asia map explorer (click countries, capitals, borders, economic/population layers) mapped to `concept_id`.
  * **Direct Telemetry:** Built-in components emit `{ completed, score, timeSpentSec }` directly into `learning_events` (Community HTML/JS upload & sandbox deferred to v2+).
* **Exit Criteria:** At least 2–3 built-in interactive Political Geography map/data activities embed cleanly in Grade 9 units and record completion telemetry.

---

## Phase 4: Enriched Quiz Generation, Quiz Components & Exercises
**Goal:** Build the auto-graded assessment engine and AI-assisted question bank tied to concepts.
* **Deliverables:**
  * **AI Quiz & Exercise Generator (`services/ai-worker`):** Generate unit question banks (`mcq`, `map_pin`, `matching`, `fill_blank`, `ordering`) mapped to `concept_id` + hints.
  * **Interactive Quiz UI Components:** Mobile-friendly quiz & map-selection exercises, step hints, and instant auto-grading. *(Add MathLive keypad + SymPy equivalence in v1.1 for Algebra.)*
  * **Persistence & Diagnostics:** Save `quizzes`, `questions`, `quiz_attempts`, and granular `quiz_attempt_items` (`time_spent_sec`, `hints_used`, `error_category`).
* **Exit Criteria:** Teachers/students can generate, customize, take, and auto-grade unit quizzes with question-level diagnostics saved to PostgreSQL.

---

## Phase 5: School Management & User Auth / RBAC
**Goal:** Turn the content engine into a secure multi-tenant Online School & Self-Study platform.
* **Deliverables:**
  * **Authentication:** Passwordless **Telegram Bot OTP + Email Magic Link/OTP** login, JWT + `HttpOnly` refresh cookies. *(WhatsApp/SMS OTP deferred to v2+.)*
  * **RBAC Middleware:** Enforce `student`, `teacher`, `parent`, and `admin` permissions.
  * **School & Class Management:** Create schools (`free` / `b2b`), create classes (e.g., *9-A Algebra*), generate Class Join Codes, manage enrollments, and verify `parent_student_links`.
  * **Telemetry Pipeline (`POST /api/events/batch`):** Attach `learning_events` (including offline sync) and `student_concept_mastery` updates to authenticated `student_id` and `class_id`.
* **Exit Criteria:** A teacher can create a school/class, invite students via join code, link parents, and securely isolate class data from other schools.

---

## Phase 6: Teacher, Parent & Student Dashboards (Views & Reports)
**Goal:** Surface real-time mastery, strengths/weaknesses, and usage reports.
* **Deliverables:**
  * **Teacher Dashboard:** Class Strength/Weakness Matrix (students × concepts), local **5-point grade (2–5)** conversion, assignment completion, and CSV/PDF quarter report exports.
  * **Parent Portal:** Live progress feed (units read, widgets completed, quiz scores, concept strengths/weaknesses) + optional **Telegram Bot digests**.
  * **Student Dashboard:** Personal mastery tracker, retention alerts (`due_for_review`), and "What to review next" recommendations.
  * **Author Royalty Reports:** Daily/monthly `book_usage_daily` aggregation UI for admin/authors.
* **Exit Criteria:** All three personas see live, accurate analytics driven by `student_concept_mastery` and `learning_events`.

---

## Phase 7: AI Integrations (Socratic Tutor & Cost Controls)
**Goal:** Launch the interest-personalized, syllabus-grounded Socratic AI Tutor.
* **Deliverables:**
  * **RAG Indexing:** Chunk published `units` + diagram `ai_description`s into `unit_chunks` (`pgvector`) partitioned by `country_code` and `language`.
  * **Socratic AI Tutor (`services/ai-worker`):** Streaming chat grounded strictly in the current unit, adapting analogies to `user.interests` (e.g., football) in `ky`/`ru`, without giving direct quiz answers.
  * **Tutor Telemetry & Quotas:** Log structured `tutor_session` metadata (`intent_type`, `hints_needed_to_solve`, `analogy_topic`, `post_tutor_outcome`) and enforce Redis daily quotas for `free` vs `pro` tiers.
* **Exit Criteria:** Students can ask the tutor about any Political Geography unit in Kyrgyz or Russian, get interest-tailored Socratic hints, and respect tier quotas.

---

## Phase 8: School Public Pages & Public Posts
**Goal:** Enable schools and educators to showcase their programs, attract students, and publish public updates.
* **Deliverables:**
  * **Public School Profiles (`/schools/[slug]`):** SEO-friendly public landing pages (school overview, subjects/syllabi offered, verified teachers, enrollment/contact CTA).
  * **Public Posts & Announcements:** Schools/teachers can publish public posts (open lessons, study guides, olympiad prep, school news) with embedded verified interactive materials.
  * **Moderation & Discovery:** Basic content moderation, public feed/directory by city/region, and shareable links for Telegram/WhatsApp.
* **Exit Criteria:** Any school can publish a public profile and post shareable educational content that drives organic student/parent signups.

---

## v1.1 Fast Follow: Grade 9 Algebra Expansion
**Goal:** Layer STEM math capabilities onto the proven Geography platform.
* **Deliverables:**
  * Enable **KaTeX (`mhchem`) SSR** in the Block AST Reader & PDF ingestion LaTeX review.
  * Add **MathLive (`<math-field>`)** mobile keypad + **SymPy** symbolic algebraic equivalence grading (`services/ai-worker`).
  * Ingest Grade 9 Algebra (Kyrgyz & Russian) + add built-in linear/quadratic grapher visualizers.
