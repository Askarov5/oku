from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PlanBlockModel(BaseModel):
    id: str
    lessonNumber: int = Field(ge=1)
    title: str
    minutes: int = Field(ge=1, le=90)
    pageRef: str | None = None
    explanation: str
    teacherNote: str = ""


class LessonPlanPayload(BaseModel):
    title: str
    planBlocks: list[PlanBlockModel]

    @field_validator("planBlocks")
    @classmethod
    def at_least_one(cls, value: list[PlanBlockModel]) -> list[PlanBlockModel]:
        if not value:
            raise ValueError("planBlocks must not be empty")
        return value


class SlideModel(BaseModel):
    id: str
    kind: Literal[
        "concept", "worked_example", "uploaded_media", "quiz_launch"
    ]
    lessonNumber: int = Field(ge=1)
    title: str
    bullets: list[str] = Field(default_factory=list)
    formulaOrCallout: str | None = None
    pageRef: str | None = None
    imageUrl: str | None = None
    imageCaption: str | None = None
    speakerNotes: str = ""


class ChoiceModel(BaseModel):
    id: str
    shape: Literal["triangle", "diamond", "circle", "square"]
    text: str
    isCorrect: bool


class QuestionModel(BaseModel):
    id: str
    prompt: str
    scenarioNote: str | None = None
    timeLimitSec: int = Field(default=20, ge=5, le=120)
    points: int = Field(default=1000, ge=100)
    choices: list[ChoiceModel]
    explanation: str = ""

    @model_validator(mode="after")
    def one_correct(self) -> QuestionModel:
        correct = [choice for choice in self.choices if choice.isCorrect]
        if len(self.choices) < 2:
            raise ValueError("each question needs at least two choices")
        if len(correct) != 1:
            raise ValueError("each question needs exactly one correct choice")
        return self


class HomeworkModel(BaseModel):
    id: str
    title: str
    prompt: str
    expectedMinutes: int = Field(ge=1, le=120)
    answerGuide: str = ""


class LessonMaterialsPayload(BaseModel):
    slides: list[SlideModel] = Field(default_factory=list)
    questions: list[QuestionModel] = Field(default_factory=list)
    homework: list[HomeworkModel] = Field(default_factory=list)
