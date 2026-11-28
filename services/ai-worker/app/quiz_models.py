from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

QuizChoiceShape = Literal["triangle", "diamond", "circle", "square"]
QuizItemKind = Literal[
    "multiple_choice",
    "checkboxes",
    "true_false",
    "numeric_range",
    "matching",
    "ordering",
]

DEFAULT_TIME_LIMITS: dict[str, int] = {
    "multiple_choice": 20,
    "true_false": 15,
    "checkboxes": 30,
    "numeric_range": 40,
    "ordering": 40,
    "matching": 45,
}

CHOICE_SHAPES: list[QuizChoiceShape] = [
    "triangle",
    "diamond",
    "circle",
    "square",
]


class ChoiceModel(BaseModel):
    id: str
    shape: QuizChoiceShape | None = None
    text: str
    isCorrect: bool | None = None


class MatchingPromptModel(BaseModel):
    id: str
    text: str


class MatchingOptionModel(BaseModel):
    id: str
    text: str


class OrderingItemModel(BaseModel):
    id: str
    text: str


class MultipleChoiceDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    choices: list[ChoiceModel]

    @model_validator(mode="after")
    def validate_choices(self) -> MultipleChoiceDraft:
        if len(self.choices) < 2 or len(self.choices) > 4:
            raise ValueError("multiple_choice needs 2–4 choices")
        correct = [c for c in self.choices if c.isCorrect]
        if len(correct) != 1:
            raise ValueError("multiple_choice needs exactly one correct choice")
        return self


class CheckboxesDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    choices: list[ChoiceModel]

    @model_validator(mode="after")
    def validate_choices(self) -> CheckboxesDraft:
        if len(self.choices) < 3 or len(self.choices) > 5:
            raise ValueError("checkboxes needs 3–5 choices")
        correct = [c for c in self.choices if c.isCorrect]
        if len(correct) < 2:
            raise ValueError("checkboxes needs at least two correct choices")
        return self


class TrueFalseDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    correct: bool


class NumericRangeDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    unit: str | None = None
    min: float
    max: float

    @model_validator(mode="after")
    def validate_range(self) -> NumericRangeDraft:
        if self.max < self.min:
            raise ValueError("numeric_range max must be >= min")
        return self


class MatchingDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    prompts: list[MatchingPromptModel]
    options: list[MatchingOptionModel]
    pairs: dict[str, str]

    @model_validator(mode="after")
    def validate_pairs(self) -> MatchingDraft:
        if len(self.prompts) < 3 or len(self.prompts) > 5:
            raise ValueError("matching needs 3–5 prompts")
        if len(self.options) < len(self.prompts):
            raise ValueError("matching needs at least as many options as prompts")
        prompt_ids = {p.id for p in self.prompts}
        option_ids = {o.id for o in self.options}
        if set(self.pairs.keys()) != prompt_ids:
            raise ValueError("matching pairs must cover every prompt")
        if not set(self.pairs.values()).issubset(option_ids):
            raise ValueError("matching pairs must reference option ids")
        return self


class OrderingDraft(BaseModel):
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    items: list[OrderingItemModel]
    order: list[str]

    @model_validator(mode="after")
    def validate_order(self) -> OrderingDraft:
        if len(self.items) < 3 or len(self.items) > 5:
            raise ValueError("ordering needs 3–5 items")
        ids = [item.id for item in self.items]
        if sorted(self.order) != sorted(ids):
            raise ValueError("ordering order must list every item id once")
        return self


class QuizItemsPayload(BaseModel):
    questions: list[dict]

    @field_validator("questions")
    @classmethod
    def at_least_one(cls, value: list[dict]) -> list[dict]:
        if not value:
            raise ValueError("questions must not be empty")
        return value


class QuizItemModel(BaseModel):
    id: str
    kind: QuizItemKind
    prompt: str
    scenarioNote: str | None = None
    explanation: str = ""
    timeLimitSec: int = Field(default=20, ge=5, le=120)
    points: int = Field(default=1000, ge=100)
    requireExplanation: bool = False
    # kind-specific public + key fields flattened for storage helpers
    choices: list[ChoiceModel] | None = None
    unit: str | None = None
    min: float | None = None
    max: float | None = None
    correct: bool | None = None
    prompts: list[MatchingPromptModel] | None = None
    options: list[MatchingOptionModel] | None = None
    pairs: dict[str, str] | None = None
    items: list[OrderingItemModel] | None = None
    order: list[str] | None = None

    def to_storage(self) -> dict:
        base = {
            "id": self.id,
            "kind": self.kind,
            "prompt": self.prompt,
            "scenarioNote": self.scenarioNote,
            "explanation": self.explanation,
            "timeLimitSec": self.timeLimitSec,
            "points": self.points,
            "requireExplanation": self.requireExplanation,
        }
        if self.kind == "multiple_choice":
            choices = self.choices or []
            stamped = []
            correct_id = ""
            for index, choice in enumerate(choices):
                shape = CHOICE_SHAPES[index] if index < len(CHOICE_SHAPES) else "square"
                stamped.append(
                    {"id": choice.id, "shape": shape, "text": choice.text}
                )
                if choice.isCorrect:
                    correct_id = choice.id
            return {
                **base,
                "spec": {"choices": stamped},
                "answerKey": {"correctChoiceId": correct_id},
            }
        if self.kind == "checkboxes":
            choices = self.choices or []
            return {
                **base,
                "spec": {
                    "choices": [{"id": c.id, "text": c.text} for c in choices]
                },
                "answerKey": {
                    "correctChoiceIds": [c.id for c in choices if c.isCorrect]
                },
            }
        if self.kind == "true_false":
            return {
                **base,
                "spec": {},
                "answerKey": {"correct": bool(self.correct)},
            }
        if self.kind == "numeric_range":
            return {
                **base,
                "spec": {"unit": self.unit},
                "answerKey": {"min": self.min, "max": self.max},
            }
        if self.kind == "matching":
            return {
                **base,
                "spec": {
                    "prompts": [p.model_dump() for p in (self.prompts or [])],
                    "options": [o.model_dump() for o in (self.options or [])],
                },
                "answerKey": {"pairs": self.pairs or {}},
            }
        return {
            **base,
            "spec": {"items": [i.model_dump() for i in (self.items or [])]},
            "answerKey": {"order": self.order or []},
        }
