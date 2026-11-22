# Master Product Requirements Document (PRD)

**Product:** Centralized Curriculum Education Platform (Working Title)  
**Initial Wedge:** Kyrgyzstan — Grade 9 **Algebra** (Kyrgyz & Russian languages), Online School + Self-Study  
**Document Owner:** Cofounder & Lead Architect  
**Status:** Draft v1.3 (MVP-Ready)  

---

## 1. Executive Summary & Vision

In countries with centralized education systems (starting with Kyrgyzstan and expanding across Central Asia / post-Soviet states), every student in a given grade studies the exact same national textbooks and syllabus. Yet teachers spend hours preparing lessons and grading, students lack paper textbooks and engaging study aids, and parents/schools lack real-time visibility into concept-level mastery.

**Our Vision:** A unified education platform built around a **Canonical National Curriculum Graph**. Ingest each national textbook once → auto-generate unit syllabi, teaching materials, and quizzes → layer on community-built interactive HTML/CSS/JS simulations, an interest-personalized AI tutor, and live parent/teacher analytics.

---

## 2. Target Users & Personas

| Persona | Primary Needs |
| :--- | :--- |
| **Student (Grade 9)** | Access textbooks without paper copies (even on 3G/budget Android), understand hard topics via personalized analogies & interactive games, practice quizzes, see strengths/weaknesses. |
| **Teacher** | Zero-prep lesson plans & quizzes aligned to the national syllabus, automatic grading, instant class-wide weakness detection, ability to customize/upload own materials (for private/unique schools). |
| **Parent** | Real-time visibility into what their child read, completed, and scored; clear summary of strengths, weaknesses, and study habits (web + Telegram notifications). |
| **Content Creator / Educator** | Publish interactive HTML/CSS/JS widgets (3D models, simulations, GeoPlayer-style games), earn upvotes and official verification. |
| **School / Platform Admin** | Manage canonical books, verify community widgets, monitor usage-based author royalties, manage school-level accounts. |

---

## 3. Release Phasing Overview

* **v1 (MVP — Asynchronous Online School, Self-Study & Teacher Copilot):**
  * Digital Library & Textbook-to-Syllabus Engine
  * First-Party Teaching/Learning Materials (Curated Interactive Visualizers, Worked Examples & Notes)
  * Auto-Graded Quizzes & Teacher Studio (with Symbolic Math Grading)
  * Interest-Personalized Socratic AI Tutor
  * Live Teacher & Parent Progress Dashboards
  * Usage-Based Author Royalty Metering
* **v2+ (Expansion):**
  * Community Interactive Materials Marketplace + Sandboxed HTML/CSS/JS Widget Runner
  * Kahoot-style Live Classroom Trivia
  * Psychometric & Aptitude Assessments
  * Longitudinal AI College & Career Counselor
  * Grades 1–11 & Regional Expansion (Kazakhstan, Uzbekistan, etc.)

---

## 4. Functional Requirements

### Module A: Digital Library & Textbook-to-Syllabus Engine (`v1`)

* **A1. Canonical Book Ingestion Pipeline:**
  * Admin/Teachers upload textbook PDFs (native or scanned).
  * Hybrid OCR/Vision-LLM + layout parser (e.g., MinerU/Docling + Vision LLM) extracts text, tables, diagrams, and math/chemistry formulas into LaTeX (`$...$`, `$$...$$`).
  * Must accurately support **Kyrgyz (`Ө, ө, Ү, ү, Ң, ң`)** and **Russian** Cyrillic characters.
  * Human-in-the-loop review UI to fix OCR/formula errors before publishing.
* **A2. Standard Storage & Rendering:**
  * Books stored as **Structured Unit JSON**: each unit has a **header** (title, page range) and a **body**. The body is continuous **Markdown + LaTeX** (headings, paragraphs, lists, and tables stay inside the Markdown) interrupted only by **components**. Auto-digitisation emits one component, `image`; other components (`callout`, `exercise`, `material_anchor`, and first-party interactive components) are authored afterwards and never produced by ingestion.
  * The book is split and displayed **by unit**. A unit starts at a `unit_header` that the reviewer confirms on the page; the header shows in the table of contents and above the unit body, never inside the text.
  * A **page is an anchor**, not a container. `page_anchor` marks where each original textbook page starts inside a unit body (rendered as a subtle rule with the page number, e.g., *42-б. / стр. 42*, or inline when a paragraph runs across the page turn), so teachers can say *"Open page 42"*, the reader can jump to any page, and the AI Tutor can cite exact pages. The printed page number is stored separately from the PDF position.
  * Math & Chemistry rendered via **KaTeX** (+ `mhchem` extension) with Server-Side Rendering (SSR).
  * Extracted diagrams/figures cropped at 200–300 DPI, compressed to **WebP**, stored on S3-compatible object storage (e.g., Cloudflare R2), and tagged with `ai_description` for accessibility and AI Tutor context.
* **A3. Auto-Generated Syllabus & Teaching Pack:**
  * Each textbook chapter/section maps to a **Unit (= 1 Class)** with learning objectives, key concepts (`concept_id`), summary notes, and a generated question bank.
* **A4. Custom & Unique School Support:**
  * Private/unique schools can **fork** a canonical syllabus (reorder/hide units, add custom notes) or upload their own PDFs as a `CustomSchoolBook`.
* **A5. Offline-Capable Reader (PWA):**
  * Students can cache assigned units (JSON + WebP images) in IndexedDB for offline reading and sync progress when reconnected.
* **A6. Author Royalty / Usage Metering:**
  * Track unique active students and unit reads per `book_id` to generate auditable monthly usage reports for textbook authors/publishers.

---

### Module B: Teacher Studio & Auto-Grading (`v1`)

* **B1. Class & Roster Management:**
  * Create classes (e.g., *9-A Algebra*), invite students via teacher-generated class join code/link.
  * Assign a canonical or custom syllabus organized by the **4 academic quarters (четверть)**.
* **B2. Assignment & Pacing:**
  * Assign specific Units, Quizzes, and Interactive Widgets with optional due dates.
  * Inject additional resources or community widgets directly between textbook blocks.
* **B3. Auto-Graded Assessment Engine:**
  * Support MCQ (single/multi), numerical input (with tolerance/unit support), **symbolic algebraic equivalence checking (SymPy)**, matching, fill-in-the-blank, and ordering.
  * Mobile-friendly math keypad (**MathLive**) so students can easily enter fractions, exponents, and roots on phones.
  * Instant grading upon submission; scores map directly to `concept_id` and automatically convert between **0–100% mastery** and the local **5-point grading scale (2, 3, 4, 5)**.
* **B4. Class Analytics & Reporting:**
  * **Class Strength/Weakness Matrix:** Heatmap of students × concepts showing mastery %, 5-point grade equivalent, completion status, and time spent.
  * Exportable quarter/unit reports (CSV/PDF) for school administration.

---

### Module C: Student Learning Hub & AI Tutor (`v1`)

* **C1. Authentication & Onboarding:**
  * **Telegram Bot OTP + Email Magic Link/OTP** login (free, instant, no mandatory email for students), plus teacher-generated Class Join Codes for instant classroom enrollment. *(WhatsApp/SMS OTP deferred to v2+.)*
* **C2. Dual Mode (Online School & Self-Study):**
  * Students enrolled in a school class follow teacher assignments; independent students can enroll in public Grade 9 Algebra self-study tracks.
* **C3. Automatic Activity & Resource Telemetry:**
  * Every unit read (scroll/time), quiz attempt, interactive widget completion, and AI tutor session is logged as a `LearningEvent` tied to `(student_id, concept_id)`.
* **C4. Interest-Personalized AI Tutor (Socratic / Guided Mode):**
  * Student profile stores interest tags (e.g., *football, music, gaming, cars*) and preferred language (`ky` / `ru`).
  * RAG-grounded strictly on the current unit’s textbook blocks + image `ai_description`s (cites exact section/page; refuses off-syllabus hallucination).
  * **Socratic Guardrails:** Guides students with hints, step-by-step scaffolding, and interest-based analogies (e.g., *"Explain quadratic trajectories using a football free kick"*); **never gives direct answers** to active quiz or homework problems.
  * **Cost Controls:** Free-tier daily message/token quota; pre-generated unit summaries and common-question caching to protect unit economics.
* **C5. Student Personal Dashboard:**
  * Visual mastery tracker per unit/quarter, streak/study time, and personalized "What to review next" recommendations.

---

### Module D: First-Party Teaching & Learning Materials (`v1`)

* **D1. Curated Platform Interactive Materials:**
  * Built-in, platform-authored interactive components (e.g., interactive quadratic/linear function graphers, step-by-step algebra visualizers) mapped directly to `Unit` and `Concept ID`.
  * Teachers can attach custom notes or curated external links between textbook blocks.
* **D2. Completion & Telemetry:**
  * Built-in interactive materials emit `{ completed, score, timeSpentSec }` directly into `LearningEvents` and `student_concept_mastery` without requiring third-party sandboxing.

---

### Module E: Parent Portal & Live Progress (`v1`)

* **E1. Parent-Student Linking:**
  * Secure invite code / verification to link parent accounts to one or more children.
* **E2. Live Progress Dashboard:**
  * Real-time feed of units read, interactive resources completed, quiz scores, and concept-level strengths & weaknesses.
* **E3. Telegram Notifications (Optional Opt-in):**
  * Weekly or milestone digests via Telegram bot (e.g., quiz completed, unit finished, mastery alert).

---

### Module F: Future Expansion Modules (`v2+` — Architectural Readiness Required in v1)

* **F1. Community Interactive Materials & Widget Sandbox:**
  * User/teacher-submitted HTML/CSS/JS bundles (3D engines, simulations, GeoPlayer-style games), community upvoting, verification workflow, isolated `widgets.<domain>` origin + `postMessage` SDK.
* **F2. Live Classroom Mode (Kahoot-style):**
  * Teacher launches real-time trivia/quiz rooms from any unit's question bank; students join via 6-digit PIN/QR; live leaderboard + team mode; results flow into the same `LearningEvents` & gradebook.
* **F3. Psychology & Aptitude Assessments:**
  * Periodic validated assessments (learning style, RIASEC career interest, motivation/well-being check-ins) stored in student profile.
* **F4. AI College & Career Counselor:**
  * Uses multi-year longitudinal `LearningEvents` + psychometric results to recommend university majors, career paths, and targeted exam prep (e.g., ORT in Kyrgyzstan).

---

## 5. Non-Functional Requirements (NFRs)

| Category | Requirement |
| :--- | :--- |
| **Localization** | Full UI, search, and AI support for **Kyrgyz** (`ky`) and **Russian** (`ru`) with strict UTF-8 Cyrillic handling. |
| **Performance & Bandwidth** | Mobile-first responsive UI; textbook pages < 300KB average payload (WebP images + KaTeX SSR); PWA offline caching for units. |
| **Security & Isolation** | User-submitted HTML/JS executed strictly on a separate origin with `sandbox="allow-scripts"` and CSP; signed `postMessage` tokens to prevent score spoofing. |
| **Privacy & Compliance** | Role-Based Access Control (RBAC: Student, Teacher, Parent, Admin); parental consent flow for minors; AI counselor/psychology tools explicitly labeled as educational guidance, not clinical diagnosis. |
| **Scalability & Observability** | Append-only `LearningEvents` log; structured logging and usage metering for accurate author royalty audits. |

---

## 6. Multi-Country Extensibility Architecture

To expand seamlessly from Kyrgyzstan to Kazakhstan, Uzbekistan, Azerbaijan, Tajikistan, Turkey, and beyond without code rewrites, the platform separates **universal learning concepts** from **country-specific rules and textbooks**:

1. **Universal Concept Taxonomy (`canonical_concept_id`):**
   * Textbooks, units, quizzes, and interactive widgets map to universal concept IDs (e.g., `math.algebra.quadratic_equations`) rather than hardcoded country/grade/page references.
   * **Cross-border reuse:** An interactive 3D simulation or game created in Kyrgyzstan for `quadratic_equations` is immediately discoverable in Kazakhstan or Uzbekistan, even if taught in a different grade.
2. **Declarative `CountryConfig` (Zero Hardcoded Local Rules):**
   * Each country is configured via data:
     * `languages`: e.g., `['ky', 'ru']` (KG), `['kk', 'ru']` (KZ), `['uz', 'ru']` (UZ), `['tr']` (TR).
     * `grade_system`: `1–11` vs `1–12`.
     * `grading_scale`: Internal mastery is always stored as `0.0–1.0` and rendered via country adapters (e.g., 5-point `2–5`, 10-point `1–10`, or 100-point `0–100`).
     * `academic_calendar`: `4 quarters (четверть)` vs `2 semesters`.
     * `national_exams`: `ORT` (KG), `ENT` (KZ), `DTM` (UZ) for v2+ college counseling.
3. **Locale-Partitioned Storage & RAG:**
   * Asset keys (`books/{country_code}/{grade}/{subject}/...`) and `pgvector` embeddings are partitioned by `country_code` and `language_code` so AI Tutor retrieval stays strictly scoped to the student's national textbook.
   * Full UTF-8 support across Cyrillic (KG, KZ, TJ) and Latin (UZ, AZ, TR) scripts.
4. **Content vs. Student PII Separation (Data Residency Ready):**
   * Global curriculum content and community widgets are decoupled from student/school PII (`school_id`, `student_id`, `LearningEvents`), allowing regional PII database shards per country to satisfy local data-localization laws.

---

## 7. Recommended Tech Stack Summary

* **Frontend:** Next.js (TypeScript) + Tailwind CSS + PWA (IndexedDB offline cache) + KaTeX (`mhchem`).
* **Core API:** Node.js / TypeScript (or FastAPI) + PostgreSQL + `pgvector` (curriculum graph, users, mastery, RAG embeddings).
* **AI & Ingestion Worker:** Python (MinerU/Docling + Vision-LLM hybrid OCR, quiz generation, RAG AI Tutor).
* **Storage & CDN:** Cloudflare R2 (or S3) for textbook PDFs, WebP diagrams, and static widget bundles.
* **Widget Sandbox:** Isolated static origin (`widgets.<domain>`) + `postMessage` SDK.

---

## 8. Business Model & Monetization (`Freemium B2C + B2B Schools`)

* **Free Tier (Student & Teacher Acquisition):**
  * Full access to digital textbooks (Algebra Grade 9), standard unit quizzes, community widgets, and a daily-capped AI Tutor quota.
  * Basic teacher class management and auto-grading to drive rapid organic adoption.
* **Paid B2C Tier (Parents / Self-Study Pro):**
  * Unlimited Socratic AI Tutor, full Parent Live Analytics + Telegram digests, detailed strength/weakness diagnostics, and (in v2+) psychometric/AI counselor reports.
* **Paid B2B Tier (Private, Unique & Online Schools):**
  * Per-student seat license for custom syllabus/book uploads, school-wide admin dashboards, quarter report exports, and priority support.
* **Author Royalty Pool:**
  * Textbook authors/publishers are compensated monthly from a revenue-share pool proportional to verified active student reads (`book_id` usage metering in Module A6).

---

## 9. Success Metrics (v1 Pilot — Kyrgyzstan Grade 9 Algebra)

1. **Teacher Time Saved:** Teachers set up a class and assign a week of materials in **< 5 minutes**.
2. **Student Engagement:** > 60% of students who read a unit also complete its quiz or an interactive widget.
3. **Extraction Accuracy:** > 98% accuracy on Kyrgyz/Russian text and LaTeX formulas post-ingestion review.
4. **Parent Visibility:** Weekly active parent check-ins (web or Telegram).
