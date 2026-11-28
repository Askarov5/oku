from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.lesson_llm import generate_validated, mock_plan, parse_json_object
from app.lesson_models import LessonPlanPayload


def _grounding() -> dict[str, Any]:
    return {
        "unitTitle": "Free kicks",
        "pageRangeLabel": "pp. 10–12",
        "bookTitle": "Physics 9",
        "language": "en",
        "summary": "Forces and trajectories.",
        "keyTerms": ["force"],
        "markdownExcerpt": "A free kick is a restart.",
        "amountOfLessons": 1,
        "minutesPerLesson": 45,
        "audience": "Grade 9",
        "creativeAngle": "",
        "figures": [],
        "noteAttachments": [],
    }


def test_valid_plan_payload_parses() -> None:
    payload = mock_plan(_grounding())
    assert payload.title == "Free kicks"
    assert len(payload.planBlocks) >= 4
    assert all(block.lessonNumber == 1 for block in payload.planBlocks)


def test_invalid_json_retries_once_then_raises() -> None:
    calls = {"n": 0}

    def fake_complete(prompt: str, *, model: str) -> str:
        _ = prompt, model
        calls["n"] += 1
        return "not-json{{"

    with (
        patch("app.lesson_llm.uses_mock", return_value=False),
        patch("app.lesson_llm.resolve_model", return_value="gemini/gemini-3.6-flash"),
        patch("app.lesson_llm.model_name", return_value="gemini/gemini-3.6-flash"),
        patch("app.lesson_llm._complete_json", side_effect=fake_complete),
    ):
        with pytest.raises((json.JSONDecodeError, ValueError, ValidationError)):
            generate_validated(
                prompt="make a plan",
                model_cls=LessonPlanPayload,
            )
    assert calls["n"] == 2


def test_parse_json_object_strips_fences() -> None:
    raw = '```json\n{"title": "T", "planBlocks": []}\n```'
    assert parse_json_object(raw)["title"] == "T"
