from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


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


class LessonMaterialsPayload(BaseModel):
    """Slides only. Quiz items come from quiz_generate."""

    slides: list[SlideModel] = Field(default_factory=list)
