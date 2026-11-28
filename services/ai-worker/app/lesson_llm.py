from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.config import settings
from app.lesson_models import (
    LessonMaterialsPayload,
    LessonPlanPayload,
)
from app.llm import EXTRACTION_MODEL_SETTING, model_name, provider_api_key, resolve_model, uses_mock

logger = logging.getLogger("oku.worker.lesson")

T = TypeVar("T", bound=BaseModel)

_INVALID_ESCAPE = re.compile(r"\\(.)", re.DOTALL)


def _drop_invalid_escape(match: re.Match[str]) -> str:
    return match.group(0) if match.group(1) in '"\\/bfnrtu' else match.group(1)


def parse_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = json.loads(_INVALID_ESCAPE.sub(_drop_invalid_escape, text))
    if not isinstance(payload, dict):
        raise ValueError("model answer is not a JSON object")
    return payload


def validate_or_raise(model: type[T], payload: dict[str, Any]) -> T:
    return model.model_validate(payload)


def mock_plan(grounding: dict[str, Any]) -> LessonPlanPayload:
    amount = max(1, int(grounding.get("amountOfLessons") or 1))
    minutes = max(20, int(grounding.get("minutesPerLesson") or 45))
    page_ref = grounding.get("pageRangeLabel") or None
    unit = grounding.get("unitTitle") or "Unit"
    blocks = []
    for lesson in range(1, amount + 1):
        slice_minutes = [
            max(3, minutes // 6),
            max(5, minutes // 3),
            max(5, minutes // 4),
            max(4, minutes // 6),
            max(3, minutes - (minutes // 6 + minutes // 3 + minutes // 4 + minutes // 6)),
        ]
        titles = [
            "Warm-up",
            "Core idea",
            "Guided practice",
            "Quick check",
            "Wrap-up",
        ]
        for index, (title, mins) in enumerate(zip(titles, slice_minutes), start=1):
            blocks.append(
                {
                    "id": f"plan-{lesson}-{index}",
                    "lessonNumber": lesson,
                    "title": title,
                    "minutes": mins,
                    "pageRef": page_ref,
                    "explanation": f"{title} for {unit}.",
                    "teacherNote": "Keep students on the textbook pages cited.",
                }
            )
    return LessonPlanPayload.model_validate({"title": unit, "planBlocks": blocks})


def mock_materials(
    grounding: dict[str, Any],
    plan_blocks: list[dict[str, Any]],
    deliverables: dict[str, bool],
    share_code: str,
) -> LessonMaterialsPayload:
    unit = grounding.get("unitTitle") or "Unit"
    page_ref = grounding.get("pageRangeLabel") or None
    payload: dict[str, Any] = {"slides": [], "questions": [], "homework": []}
    if deliverables.get("slides"):
        payload["slides"] = [
            {
                "id": "slide-1",
                "kind": "concept",
                "lessonNumber": 1,
                "title": unit,
                "bullets": [grounding.get("summary") or "Open the unit."],
                "formulaOrCallout": None,
                "pageRef": page_ref,
                "imageUrl": None,
                "imageCaption": None,
                "speakerNotes": "Start from the textbook pages.",
            },
            {
                "id": "slide-2",
                "kind": "concept",
                "lessonNumber": 1,
                "title": plan_blocks[0]["title"] if plan_blocks else "Concept",
                "bullets": [block["explanation"] for block in plan_blocks[:3]],
                "formulaOrCallout": None,
                "pageRef": page_ref,
                "imageUrl": None,
                "imageCaption": None,
                "speakerNotes": "Stay close to the unit text.",
            },
        ]
        if deliverables.get("kahootTest"):
            payload["slides"].append(
                {
                    "id": "slide-quiz",
                    "kind": "quiz_launch",
                    "lessonNumber": 1,
                    "title": "Kahoot check",
                    "bullets": [f"Open /play/{share_code}"],
                    "formulaOrCallout": None,
                    "pageRef": None,
                    "imageUrl": None,
                    "imageCaption": None,
                    "speakerNotes": "Students join on their own devices.",
                }
            )
    if deliverables.get("kahootTest"):
        payload["questions"] = [
            {
                "id": f"q-{i}",
                "prompt": f"Question {i} about {unit}",
                "scenarioNote": None,
                "timeLimitSec": 20,
                "points": 1000,
                "choices": [
                    {
                        "id": f"q-{i}-a",
                        "shape": "triangle",
                        "text": "Option A",
                        "isCorrect": True,
                    },
                    {
                        "id": f"q-{i}-b",
                        "shape": "diamond",
                        "text": "Option B",
                        "isCorrect": False,
                    },
                    {
                        "id": f"q-{i}-c",
                        "shape": "circle",
                        "text": "Option C",
                        "isCorrect": False,
                    },
                    {
                        "id": f"q-{i}-d",
                        "shape": "square",
                        "text": "Option D",
                        "isCorrect": False,
                    },
                ],
                "explanation": "Option A matches the unit.",
            }
            for i in range(1, 5)
        ]
    if deliverables.get("homework"):
        payload["homework"] = [
            {
                "id": "hw-1",
                "title": "Practice",
                "prompt": f"Rewrite the main idea of {unit} in your own words.",
                "expectedMinutes": 8,
                "answerGuide": grounding.get("summary") or "Check against the unit summary.",
            },
            {
                "id": "hw-2",
                "title": "Apply",
                "prompt": "Solve one exercise from the textbook pages in this unit.",
                "expectedMinutes": 10,
                "answerGuide": "Compare with the worked example in class.",
            },
        ]
    return LessonMaterialsPayload.model_validate(payload)


def _complete_json(prompt: str, *, model: str) -> str:
    import litellm

    reasoning: dict[str, Any] = {}
    if settings.llm_reasoning_effort:
        reasoning["reasoning_effort"] = settings.llm_reasoning_effort

    response = litellm.completion(
        **reasoning,
        model=model,
        temperature=0.4,
        drop_params=True,
        api_key=provider_api_key(model),
        timeout=settings.llm_timeout_sec,
        num_retries=0,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    content = response["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise ValueError("empty model response")
    return content


def generate_validated(
    *,
    prompt: str,
    model_cls: type[T],
    saved_model: Any = None,
    mock_factory: Any = None,
) -> tuple[T, str]:
    """Call the model, validate with Pydantic, retry once on invalid JSON/schema."""
    model = resolve_model(saved_model)
    recorded = model_name(model)
    if uses_mock(model):
        if mock_factory is None:
            raise RuntimeError("mock factory required when LLM is mocked")
        return mock_factory(), recorded

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            raw = _complete_json(prompt, model=model)
            payload = parse_json_object(raw)
            return validate_or_raise(model_cls, payload), recorded
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            logger.warning("lesson LLM validation failed (attempt %s): %s", attempt + 1, exc)
    assert last_error is not None
    raise last_error


def resolve_lesson_model(conn: Any) -> Any:
    from app import db as dbmod

    return dbmod.get_setting(conn, EXTRACTION_MODEL_SETTING)
