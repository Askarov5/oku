# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, TypeScript) + Tailwind CSS + PWA (IndexedDB offline cache) on Vercel; Python (FastAPI) AI & OCR worker on Railway/Fly.io; PostgreSQL 16 + `pgvector`; Cloudflare R2 for media storage.

## Users

* **Students (v1.0 Wedge: Grade 9 in Kyrgyzstan, Kyrgyz & Russian):** Studying Political Geography (and Algebra in v1.1) via online school classes or independent self-study, often on budget Android phones over 3G/4G and in regions with paper-textbook shortages.
* **Teachers:** Preparing daily lessons, assigning unit readings and interactive map activities, auto-grading quizzes, and tracking class-wide concept mastery on the 5-point grading scale (2–5) across 4 academic quarters.
* **Parents:** Monitoring live child progress, completed resources, quiz scores, and concept-level strengths and weaknesses (web + Telegram digests).
* **School & Platform Admins:** Managing canonical textbooks, page-level OCR review, school rosters, and usage-based author royalty reports.

## Product Purpose

**oku** is a centralized-curriculum education platform that turns national textbooks into structured digital units, auto-generated 4-quarter syllabi, interactive learning materials, auto-graded assessments, and a Socratic AI tutor—giving teachers zero-prep classes, students engaging book-free learning, and parents live visibility into strengths and weaknesses.

## Positioning

Unlike generic EdTech platforms where every teacher must build content from scratch, **oku** builds a **Canonical National Curriculum Graph** once per country: every textbook unit, interactive map/visualizer, quiz item, and Socratic AI tutor session maps to the same universal `canonical_concept_id`, enabling nationwide mastery analytics, offline-first delivery, and multi-country expansion via declarative `CountryConfig`.

## Operating Context

* **Academic Calendar & Grading:** 4 academic quarters (*четверть*) and the 5-point grading scale (2, 3, 4, 5) mapped from `0.0–1.0` mastery.
* **Paper Book Reference Alignment:** Digital units preserve original textbook page numbers via `page_break` markers so teachers can reference physical page numbers in class.
* **Authentication & Messaging:** Passwordless Telegram Bot OTP and Email Magic Link/OTP; Telegram is the primary parent/teacher notification channel.
* **Monetization:** Freemium B2C (free reader/quizzes + capped AI tutor; paid Parent Live Analytics & unlimited AI tutor) + B2B per-seat school licenses, funding usage-based textbook author royalties.

## Capabilities and Constraints

* **v1.0 Quick Start Scope:** Kyrgyzstan Grade 9 Political Geography (`ky` and `ru`), first-party interactive SVG/TopoJSON map materials, auto-graded quizzes (`mcq`, `map_pin`, `matching`, `fill_blank`, `ordering`), Socratic AI tutor, and offline PWA unit caching.
* **v1.1 Fast Follow:** Grade 9 Algebra with KaTeX SSR, MathLive mobile math keypad, and SymPy symbolic equivalence grading.
* **v2+ Deferred:** Community-uploaded HTML/CSS/JS widgets & sandbox, Kahoot-style live classrooms, psychometric tests, and AI college counselor.
* **Technical Constraints:** <300KB average textbook unit payload; WebP diagrams on Cloudflare R2; strict Cyrillic UTF-8 support (`Ө, ө, Ү, ү, Ң, ң`); PostgreSQL as source of truth for learning telemetry (PostHog restricted to pseudonymous product analytics).

## Brand Commitments

* **Name:** **oku**
* **Binding Visual Constraint:** Must support both **dark and light themes**.
* **Undecided:** Logo mark and final marketing tagline remain undecided.

## Evidence on Hand

* Product requirements, technical architecture, and phased implementation roadmap are documented in [MASTER_PRD.md](./MASTER_PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [ROADMAP.md](./ROADMAP.md).
* No UI implementation, visual assets, or ingested textbook samples exist in the repository yet.

## Product Principles

1. **Canonical Once, Localized Everywhere:** Separate universal concepts from country-specific textbooks, calendars, and grading scales.
2. **Low-Bandwidth First:** Design every reading, map, and quiz flow for budget Android devices and intermittent 3G/4G connections.
3. **Socratic Guidance Over Answers:** Help students build understanding through hints and personal-interest analogies rather than giving away quiz answers.
4. **Evidence-Based Mastery:** Capture granular question-level and reading-depth telemetry so teachers and parents see *why* a student is strong or struggling.

## Accessibility & Inclusion

* Full UTF-8 Cyrillic support for Kyrgyz (`Ө, ө, Ү, ү, Ң, ң`) and Russian across UI, search, and AI responses.
* Every textbook diagram and map includes `ai_description` alt text for screen readers and AI Tutor context.
* Both dark and light themes must meet WCAG AA contrast across reading, map, and dashboard surfaces.
