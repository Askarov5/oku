from __future__ import annotations

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable

from pydantic import BaseModel, ValidationError

from app.lesson_llm import generate_validated, parse_json_object
from app.lesson_prompts import _lang_label
from app.quiz_models import (
    CHOICE_SHAPES,
    DEFAULT_TIME_LIMITS,
    CheckboxesDraft,
    MatchingDraft,
    MultipleChoiceDraft,
    NumericRangeDraft,
    OrderingDraft,
    QuizItemModel,
    TrueFalseDraft,
)

logger = logging.getLogger("oku.worker.quiz")


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _plan_digest(plan_blocks: list[dict[str, Any]] | None) -> str:
    if not plan_blocks:
        return "- (no approved plan blocks)"
    lines: list[str] = []
    for block in plan_blocks[:12]:
        title = block.get("title") or "Section"
        minutes = block.get("minutes")
        explanation = (block.get("explanation") or "").strip()
        if len(explanation) > 220:
            explanation = explanation[:217].rstrip() + "…"
        minute_bit = f"{minutes} min — " if minutes is not None else ""
        lines.append(f"- {title}: {minute_bit}{explanation or '(no explanation)'}")
    return "\n".join(lines) or "- (no approved plan blocks)"


def _grounding_blurb(
    grounding: dict[str, Any],
    *,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> str:
    return f"""Unit title: {grounding.get('unitTitle')}
Pages: {grounding.get('pageRangeLabel')}
Creative angle: {grounding.get('creativeAngle') or '(none)'}
Key terms: {', '.join(grounding.get('keyTerms') or []) or '(none)'}
Approved lesson plan (follow these sections):
{_plan_digest(plan_blocks)}
Excerpt:
{grounding.get('markdownExcerpt') or grounding.get('summary') or '(empty)'}
"""


def _batch_prompt(
    kind: str,
    count: int,
    grounding: dict[str, Any],
    schema: str,
    *,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> str:
    language = grounding.get("language") or "en"
    return f"""You are writing auto-graded quiz questions for a classroom.

Write everything in {_lang_label(language)}.
Stay faithful to the approved lesson plan and the textbook unit. Use plausible distractors, never joke options.

Return ONLY a JSON object:
{{
  "questions": [ /* exactly {count} items of kind {kind} */ ]
}}

Each item must match this shape:
{schema}

{_grounding_blurb(grounding, plan_blocks=plan_blocks)}
"""


MC_SCHEMA = """{
  "prompt": "question text",
  "scenarioNote": "hint or null",
  "explanation": "why the correct answer holds",
  "choices": [
    {"id": "a", "text": "option", "isCorrect": true},
    {"id": "b", "text": "option", "isCorrect": false}
  ]
}
Use 2–4 choices with exactly one isCorrect=true."""

CHECKBOXES_SCHEMA = """{
  "prompt": "select all that apply",
  "scenarioNote": null,
  "explanation": "why",
  "choices": [
    {"id": "a", "text": "option", "isCorrect": true},
    {"id": "b", "text": "option", "isCorrect": true},
    {"id": "c", "text": "option", "isCorrect": false}
  ]
}
Use 3–5 choices with at least two isCorrect=true."""

TRUE_FALSE_SCHEMA = """{
  "prompt": "a clear true/false statement",
  "scenarioNote": null,
  "explanation": "why",
  "correct": true
}"""

NUMERIC_SCHEMA = """{
  "prompt": "ask for a number",
  "scenarioNote": null,
  "explanation": "why",
  "unit": "J or null",
  "min": 1.0,
  "max": 1.2
}
min/max is the inclusive accepted band. Keep the band tight around the true value."""

MATCHING_SCHEMA = """{
  "prompt": "match each item",
  "scenarioNote": null,
  "explanation": "why",
  "prompts": [{"id": "p1", "text": "left"}],
  "options": [{"id": "o1", "text": "right"}],
  "pairs": {"p1": "o1"}
}
Use 3–5 prompts. Options may include one extra distractor that matches nothing."""

ORDERING_SCHEMA = """{
  "prompt": "put these steps in order",
  "scenarioNote": null,
  "explanation": "why",
  "items": [{"id": "i1", "text": "step"}],
  "order": ["i1"]
}
Use 3–5 items. order lists every item id in the correct sequence."""


def _stamp_mc(draft: MultipleChoiceDraft, index: int) -> QuizItemModel:
    choices = []
    for i, choice in enumerate(draft.choices):
        choices.append(
            {
                "id": choice.id or f"c-{i}",
                "shape": CHOICE_SHAPES[i] if i < len(CHOICE_SHAPES) else "square",
                "text": choice.text,
                "isCorrect": bool(choice.isCorrect),
            }
        )
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"mc-{index}"),
            "kind": "multiple_choice",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["multiple_choice"],
            "points": 1000,
            "requireExplanation": False,
            "choices": choices,
        }
    )


def _stamp_checkboxes(draft: CheckboxesDraft, index: int) -> QuizItemModel:
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"cb-{index}"),
            "kind": "checkboxes",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["checkboxes"],
            "points": 1000,
            "requireExplanation": False,
            "choices": [
                {
                    "id": c.id or f"c-{i}",
                    "text": c.text,
                    "isCorrect": bool(c.isCorrect),
                }
                for i, c in enumerate(draft.choices)
            ],
        }
    )


def _stamp_tf(draft: TrueFalseDraft, index: int) -> QuizItemModel:
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"tf-{index}"),
            "kind": "true_false",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["true_false"],
            "points": 1000,
            "requireExplanation": False,
            "correct": draft.correct,
        }
    )


def _stamp_numeric(draft: NumericRangeDraft, index: int) -> QuizItemModel:
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"nr-{index}"),
            "kind": "numeric_range",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["numeric_range"],
            "points": 1000,
            "requireExplanation": False,
            "unit": draft.unit,
            "min": draft.min,
            "max": draft.max,
        }
    )


def _stamp_matching(draft: MatchingDraft, index: int) -> QuizItemModel:
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"mt-{index}"),
            "kind": "matching",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["matching"],
            "points": 1000,
            "requireExplanation": False,
            "prompts": [p.model_dump() for p in draft.prompts],
            "options": [o.model_dump() for o in draft.options],
            "pairs": draft.pairs,
        }
    )


def _stamp_ordering(draft: OrderingDraft, index: int) -> QuizItemModel:
    return QuizItemModel.model_validate(
        {
            "id": _new_id(f"or-{index}"),
            "kind": "ordering",
            "prompt": draft.prompt,
            "scenarioNote": draft.scenarioNote,
            "explanation": draft.explanation,
            "timeLimitSec": DEFAULT_TIME_LIMITS["ordering"],
            "points": 1000,
            "requireExplanation": False,
            "items": [i.model_dump() for i in draft.items],
            "order": draft.order,
        }
    )


class _QuestionsWrapper(BaseModel):
    questions: list[dict[str, Any]]


def _mock_items(kind: str, count: int, grounding: dict[str, Any]) -> list[QuizItemModel]:
    unit = grounding.get("unitTitle") or "Unit"
    items: list[QuizItemModel] = []
    for i in range(count):
        if kind == "multiple_choice":
            draft = MultipleChoiceDraft.model_validate(
                {
                    "prompt": f"Which statement about {unit} is correct? ({i + 1})",
                    "scenarioNote": None,
                    "explanation": "Option A matches the unit.",
                    "choices": [
                        {"id": "a", "text": "Core idea from the unit", "isCorrect": True},
                        {"id": "b", "text": "Unrelated claim", "isCorrect": False},
                        {"id": "c", "text": "Opposite claim", "isCorrect": False},
                        {"id": "d", "text": "Distractor", "isCorrect": False},
                    ],
                }
            )
            items.append(_stamp_mc(draft, i))
        elif kind == "checkboxes":
            draft = CheckboxesDraft.model_validate(
                {
                    "prompt": f"Select all that apply for {unit} ({i + 1})",
                    "explanation": "A and B are true.",
                    "choices": [
                        {"id": "a", "text": "True claim A", "isCorrect": True},
                        {"id": "b", "text": "True claim B", "isCorrect": True},
                        {"id": "c", "text": "False claim", "isCorrect": False},
                        {"id": "d", "text": "Another false claim", "isCorrect": False},
                    ],
                }
            )
            items.append(_stamp_checkboxes(draft, i))
        elif kind == "true_false":
            draft = TrueFalseDraft.model_validate(
                {
                    "prompt": f"{unit} requires careful use of definitions. ({i + 1})",
                    "explanation": "Definitions matter in this unit.",
                    "correct": True,
                }
            )
            items.append(_stamp_tf(draft, i))
        elif kind == "numeric_range":
            draft = NumericRangeDraft.model_validate(
                {
                    "prompt": f"A sample value from {unit} is closest to which number? Enter it. ({i + 1})",
                    "explanation": "Accepted band around 10.",
                    "unit": None,
                    "min": 9.5,
                    "max": 10.5,
                }
            )
            items.append(_stamp_numeric(draft, i))
        elif kind == "matching":
            draft = MatchingDraft.model_validate(
                {
                    "prompt": f"Match terms from {unit} ({i + 1})",
                    "explanation": "Pairs follow the unit glossary.",
                    "prompts": [
                        {"id": "p1", "text": "Term A"},
                        {"id": "p2", "text": "Term B"},
                        {"id": "p3", "text": "Term C"},
                    ],
                    "options": [
                        {"id": "o1", "text": "Definition A"},
                        {"id": "o2", "text": "Definition B"},
                        {"id": "o3", "text": "Definition C"},
                        {"id": "o4", "text": "Extra distractor"},
                    ],
                    "pairs": {"p1": "o1", "p2": "o2", "p3": "o3"},
                }
            )
            items.append(_stamp_matching(draft, i))
        else:
            draft = OrderingDraft.model_validate(
                {
                    "prompt": f"Order the steps for solving a {unit} problem ({i + 1})",
                    "explanation": "Convert, apply formula, check units.",
                    "items": [
                        {"id": "i1", "text": "Identify givens"},
                        {"id": "i2", "text": "Apply the relationship"},
                        {"id": "i3", "text": "Check units and result"},
                    ],
                    "order": ["i1", "i2", "i3"],
                }
            )
            items.append(_stamp_ordering(draft, i))
    return items


def _generate_kind(
    kind: str,
    draft_cls: type[BaseModel],
    stamp: Callable[[Any, int], QuizItemModel],
    schema: str,
    grounding: dict[str, Any],
    *,
    count: int,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    payload, _model = generate_validated(
        prompt=_batch_prompt(
            kind, count, grounding, schema, plan_blocks=plan_blocks
        ),
        model_cls=_QuestionsWrapper,
        saved_model=saved_model,
        mock_factory=lambda: _QuestionsWrapper(
            questions=[q.model_dump() for q in _mock_items(kind, count, grounding)]
        ),
    )
    # When mocked, generate_validated returns the wrapper with already-stamped dumps
    # that may already be QuizItemModel shapes. Prefer re-validating drafts when possible.
    items: list[QuizItemModel] = []
    for index, raw in enumerate(payload.questions):
        if raw.get("kind") == kind and "timeLimitSec" in raw:
            items.append(QuizItemModel.model_validate(raw))
            continue
        draft = draft_cls.model_validate(raw)
        items.append(stamp(draft, index))
    if len(items) < count:
        raise ValueError(f"expected {count} {kind} questions, got {len(items)}")
    return items[:count]


def generate_multiple_choice(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "multiple_choice",
        MultipleChoiceDraft,
        _stamp_mc,
        MC_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_checkboxes(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "checkboxes",
        CheckboxesDraft,
        _stamp_checkboxes,
        CHECKBOXES_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_true_false(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "true_false",
        TrueFalseDraft,
        _stamp_tf,
        TRUE_FALSE_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_numeric_range(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "numeric_range",
        NumericRangeDraft,
        _stamp_numeric,
        NUMERIC_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_matching(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "matching",
        MatchingDraft,
        _stamp_matching,
        MATCHING_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_ordering(
    grounding: dict[str, Any],
    *,
    count: int = 1,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    return _generate_kind(
        "ordering",
        OrderingDraft,
        _stamp_ordering,
        ORDERING_SCHEMA,
        grounding,
        count=count,
        saved_model=saved_model,
        plan_blocks=plan_blocks,
    )


def generate_live_set(
    grounding: dict[str, Any],
    *,
    count: int = 4,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    """Fast end-of-class quiz: 1 MC when count=1, else 1 TF + remaining MC."""
    total = max(1, min(10, int(count)))
    if total == 1:
        return generate_multiple_choice(
            grounding,
            count=1,
            saved_model=saved_model,
            plan_blocks=plan_blocks,
        )
    mc_count = total - 1
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            pool.submit(
                generate_multiple_choice,
                grounding,
                count=mc_count,
                saved_model=saved_model,
                plan_blocks=plan_blocks,
            ): "mc",
            pool.submit(
                generate_true_false,
                grounding,
                count=1,
                saved_model=saved_model,
                plan_blocks=plan_blocks,
            ): "tf",
        }
        by_kind: dict[str, list[QuizItemModel]] = {}
        for future in as_completed(futures):
            by_kind[futures[future]] = future.result()
    return [*by_kind["mc"], *by_kind["tf"]]


# Homework rotation: mc → numeric → true/false → checkboxes → matching → ordering
_HOMEWORK_GENERATORS: list[tuple[str, Callable[..., list[QuizItemModel]]]] = [
    ("mc", generate_multiple_choice),
    ("nr", generate_numeric_range),
    ("tf", generate_true_false),
    ("cb", generate_checkboxes),
    ("mt", generate_matching),
    ("or", generate_ordering),
]


def generate_homework_set(
    grounding: dict[str, Any],
    *,
    count: int = 6,
    saved_model: Any = None,
    plan_blocks: list[dict[str, Any]] | None = None,
) -> list[QuizItemModel]:
    """Practice items by fixed kind rotation, with requireExplanation set."""
    total = max(1, min(10, int(count)))
    slots: list[tuple[str, Callable[..., list[QuizItemModel]]]] = [
        _HOMEWORK_GENERATORS[i % len(_HOMEWORK_GENERATORS)] for i in range(total)
    ]
    # Batch identical kinds into one LLM call each.
    counts_by_key: dict[str, int] = {}
    fn_by_key: dict[str, Callable[..., list[QuizItemModel]]] = {}
    for key, fn in slots:
        counts_by_key[key] = counts_by_key.get(key, 0) + 1
        fn_by_key[key] = fn

    with ThreadPoolExecutor(max_workers=min(6, len(counts_by_key))) as pool:
        futures = {
            pool.submit(
                fn_by_key[key],
                grounding,
                count=kind_count,
                saved_model=saved_model,
                plan_blocks=plan_blocks,
            ): key
            for key, kind_count in counts_by_key.items()
        }
        by_key: dict[str, list[QuizItemModel]] = {}
        for future in as_completed(futures):
            by_key[futures[future]] = future.result()

    cursors: dict[str, int] = {key: 0 for key in by_key}
    items: list[QuizItemModel] = []
    for key, _fn in slots:
        idx = cursors[key]
        item = by_key[key][idx]
        cursors[key] = idx + 1
        item.requireExplanation = True
        items.append(item)
    return items


# silence unused import warning if parse_json_object unused
_ = parse_json_object
_ = ValidationError
_ = logger
