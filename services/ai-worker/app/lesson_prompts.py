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


def materials_prompt(
    grounding: dict[str, Any],
    plan_blocks: list[dict[str, Any]],
    deliverables: dict[str, bool],
    share_code: str,
) -> str:
    language = grounding.get("language") or "en"
    wanted = [
        name
        for name, on in (
            ("slides", deliverables.get("slides")),
            ("kahootTest", deliverables.get("kahootTest")),
            ("homework", deliverables.get("homework")),
        )
        if on
    ]
    return f"""You are generating classroom teaching materials from an approved lesson plan.

Write everything in {_lang_label(language)}.
Stay faithful to the plan and the textbook unit. The creative angle only frames examples.

Return ONLY a JSON object with this shape (omit unused keys when that deliverable is off):
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
  ],
  "questions": [
    {{
      "id": "q-1",
      "prompt": "question text",
      "scenarioNote": "hint or null",
      "timeLimitSec": 20,
      "points": 1000,
      "choices": [
        {{"id": "q-1-a", "shape": "triangle", "text": "A", "isCorrect": true}},
        {{"id": "q-1-b", "shape": "diamond", "text": "B", "isCorrect": false}},
        {{"id": "q-1-c", "shape": "circle", "text": "C", "isCorrect": false}},
        {{"id": "q-1-d", "shape": "square", "text": "D", "isCorrect": false}}
      ],
      "explanation": "why the correct answer holds"
    }}
  ],
  "homework": [
    {{
      "id": "hw-1",
      "title": "task title",
      "prompt": "student task",
      "expectedMinutes": 8,
      "answerGuide": "teacher answer key"
    }}
  ]
}}

Generate only these deliverables: {', '.join(wanted) or 'none'}.
If slides are on: produce 3–5 teaching slides, then a final slide with kind "quiz_launch" that tells students to open /play/{share_code}.
If kahootTest is on: produce 4 multiple-choice questions with exactly one isCorrect=true and shapes triangle, diamond, circle, square in that order.
If homework is on: produce 2–3 practice tasks with answer guides.

Approved plan:
{plan_blocks}

Unit title: {grounding.get('unitTitle')}
Pages: {grounding.get('pageRangeLabel')}
Creative angle: {grounding.get('creativeAngle') or '(none)'}
Excerpt:
{grounding.get('markdownExcerpt') or '(empty)'}
"""
