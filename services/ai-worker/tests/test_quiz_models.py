from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.quiz_generate import generate_homework_set, generate_live_set
from app.quiz_models import (
    MatchingDraft,
    MultipleChoiceDraft,
    NumericRangeDraft,
)


def test_multiple_choice_rejects_two_correct() -> None:
    with pytest.raises(ValidationError):
        MultipleChoiceDraft.model_validate(
            {
                "prompt": "Q",
                "choices": [
                    {"id": "a", "text": "A", "isCorrect": True},
                    {"id": "b", "text": "B", "isCorrect": True},
                ],
            }
        )


def test_multiple_choice_rejects_one_choice() -> None:
    with pytest.raises(ValidationError):
        MultipleChoiceDraft.model_validate(
            {
                "prompt": "Q",
                "choices": [{"id": "a", "text": "A", "isCorrect": True}],
            }
        )


def test_numeric_range_rejects_inverted_band() -> None:
    with pytest.raises(ValidationError):
        NumericRangeDraft.model_validate(
            {
                "prompt": "Q",
                "min": 5,
                "max": 1,
            }
        )


def test_matching_rejects_too_few_pairs() -> None:
    with pytest.raises(ValidationError):
        MatchingDraft.model_validate(
            {
                "prompt": "Q",
                "prompts": [
                    {"id": "p1", "text": "A"},
                    {"id": "p2", "text": "B"},
                ],
                "options": [
                    {"id": "o1", "text": "1"},
                    {"id": "o2", "text": "2"},
                ],
                "pairs": {"p1": "o1", "p2": "o2"},
            }
        )


def test_mock_live_and_homework_sets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.lesson_llm.uses_mock", lambda _model=None: True)
    grounding = {
        "unitTitle": "Energy",
        "language": "en",
        "pageRangeLabel": "p. 1",
        "summary": "Kinetic energy",
        "keyTerms": ["Ek"],
        "markdownExcerpt": "Ek = 1/2 mv^2",
        "creativeAngle": "",
    }
    live = generate_live_set(grounding)
    assert len(live) == 4
    assert sum(1 for item in live if item.kind == "multiple_choice") == 3
    assert sum(1 for item in live if item.kind == "true_false") == 1
    assert all(not item.requireExplanation for item in live)

    homework = generate_homework_set(grounding)
    assert len(homework) == 6
    assert all(item.requireExplanation for item in homework)
    kinds = {item.kind for item in homework}
    assert kinds == {
        "multiple_choice",
        "checkboxes",
        "true_false",
        "numeric_range",
        "matching",
        "ordering",
    }
    stored = homework[0].to_storage()
    assert "spec" in stored and "answerKey" in stored
