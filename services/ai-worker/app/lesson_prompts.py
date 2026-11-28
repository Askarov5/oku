from __future__ import annotations

from typing import Any


def _lang_label(language: str) -> str:
    if language == "ky":
        return "Kyrgyz"
    if language == "ru":
        return "Russian"
    return "English"


def plan_prompt(grounding: dict[str, Any]) -> str:
    language = grounding.get("language") or "en"
    figures = grounding.get("figures") or []
    figure_lines = "\n".join(
        f"- {item.get('pageLabel', '')}: {item.get('caption') or item.get('description')}"
        for item in figures[:8]
    ) or "- (none)"
    notes = grounding.get("noteAttachments") or []
    note_block = "\n".join(f"- {note}" for note in notes[:6]) or "- (none)"
    return f"""You are an experienced Grade school teacher preparing a classroom lesson plan.

Write the lesson plan in {_lang_label(language)}.
Ground every block in the textbook unit below. The creative angle is a framing instruction, not a replacement for the unit content.
Use printed page references from the unit when possible (e.g. "{grounding.get('pageRangeLabel')}").

Return ONLY a JSON object with this shape:
{{
  "title": "short lesson title",
  "planBlocks": [
    {{
      "id": "plan-1-1",
      "lessonNumber": 1,
      "title": "section title",
      "minutes": 5,
      "pageRef": "p. 42 or null",
      "explanation": "what the teacher teaches in this block",
      "teacherNote": "classroom cue for the teacher"
    }}
  ]
}}

Rules:
- Produce exactly {int(grounding.get('amountOfLessons') or 1)} lesson(s).
- Each lesson must have 4–6 timed blocks whose minutes sum to about {int(grounding.get('minutesPerLesson') or 45)}.
- Include a warm-up, core concept, guided practice, a short check / quiz block, and a wrap-up when there is room.
- Audience: {grounding.get('audience') or 'students'}
- Creative angle: {grounding.get('creativeAngle') or '(none — teach the unit plainly)'}

Unit:
Title: {grounding.get('unitTitle')}
Pages: {grounding.get('pageRangeLabel')}
Book: {grounding.get('bookTitle')}
Summary: {grounding.get('summary')}
Key terms: {', '.join(grounding.get('keyTerms') or [])}
Figures:
{figure_lines}
Teacher notes attached:
{note_block}

Textbook excerpt:
{grounding.get('markdownExcerpt') or '(empty)'}
"""


def clamp_deliverable_count(value: Any, fallback: int, *, lo: int = 1, hi: int = 10) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = fallback
    return max(lo, min(hi, n))


def resolve_slide_count(deliverables: dict[str, Any]) -> int:
    return clamp_deliverable_count(deliverables.get("slideCount"), 4)


def resolve_quiz_count(deliverables: dict[str, Any]) -> int:
    return clamp_deliverable_count(deliverables.get("quizCount"), 4)


def resolve_homework_count(deliverables: dict[str, Any]) -> int:
    return clamp_deliverable_count(deliverables.get("homeworkCount"), 6)


def materials_prompt(
    grounding: dict[str, Any],
    plan_blocks: list[dict[str, Any]],
    deliverables: dict[str, Any],
    share_code: str,
) -> str:
    language = grounding.get("language") or "en"
    include_slides = bool(deliverables.get("slides"))
    include_quiz_launch = bool(deliverables.get("kahootTest"))
    slide_count = resolve_slide_count(deliverables)
    return f"""You are generating classroom teaching slides from an approved lesson plan.

Write everything in {_lang_label(language)}.
Stay faithful to the plan and the textbook unit. The creative angle only frames examples.
Quiz questions are generated separately — do not invent questions here.

Return ONLY a JSON object:
{{
  "slides": [
    {{
      "id": "slide-1",
      "kind": "concept|worked_example|uploaded_media|quiz_launch",
      "lessonNumber": 1,
      "title": "slide heading",
      "bullets": ["point 1", "point 2"],
      "formulaOrCallout": "optional formula or null",
      "pageRef": "p. 42 or null",
      "imageUrl": null,
      "imageCaption": null,
      "speakerNotes": "teacher cue"
    }}
  ]
}}

Slides requested: {'yes' if include_slides else 'no — return an empty slides array'}.
If slides are on: produce exactly {slide_count} teaching slides (kind concept, worked_example, or uploaded_media). Do not exceed {slide_count} teaching slides.
If a quiz launch is requested ({'yes' if include_quiz_launch else 'no'}): append a final slide with kind "quiz_launch" that tells students to open /play/{share_code}. The quiz_launch slide does not count toward the {slide_count} teaching slides.

Approved plan:
{plan_blocks}

Unit title: {grounding.get('unitTitle')}
Pages: {grounding.get('pageRangeLabel')}
Creative angle: {grounding.get('creativeAngle') or '(none)'}
Excerpt:
{grounding.get('markdownExcerpt') or '(empty)'}
"""
