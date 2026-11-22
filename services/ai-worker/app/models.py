"""Pydantic mirror of packages/shared-types/src/block-ast.ts.

Book content is continuous Markdown interrupted only by components. Headings,
lists and tables stay inside the Markdown; they are not separate blocks.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


def _new_id() -> str:
    return str(uuid.uuid4())


def _printed_page(value: object) -> str | None:
    """Models return the printed number as 42, "42" or ""; store a label or None."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class BBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(ge=0, le=1)
    h: float = Field(ge=0, le=1)


class MarkdownBlock(BaseModel):
    id: str = Field(default_factory=_new_id)
    type: Literal["markdown"]
    markdown: str


class ImageBlock(BaseModel):
    id: str = Field(default_factory=_new_id)
    type: Literal["image"]
    url: str = ""
    alt: str
    ai_description: str
    caption: str | None = None
    bbox: BBox | None = None


class UnitHeaderBlock(BaseModel):
    """A new unit starts here. The title becomes the unit header, not body content."""

    id: str = Field(default_factory=_new_id)
    type: Literal["unit_header"]
    title: str


PageBlock = Annotated[
    MarkdownBlock | ImageBlock | UnitHeaderBlock,
    Field(discriminator="type"),
]


class PageExtractedJson(BaseModel):
    pageNumber: int = Field(ge=1)
    printedPage: str | None = None
    continuesFromPrevious: bool = False
    blocks: list[PageBlock]
    warnings: list[str]
    model: str
    extractedAt: datetime | str

    _normalize_printed_page = field_validator("printedPage", mode="before")(
        _printed_page
    )


class LlmImageBlock(BaseModel):
    """An image as the model places it in the reading order; cropped and uploaded later."""

    id: str = Field(default_factory=_new_id)
    type: Literal["image"]
    alt: str = ""
    ai_description: str = ""
    caption: str | None = None
    bbox: BBox


LlmBlock = Annotated[
    MarkdownBlock | LlmImageBlock | UnitHeaderBlock,
    Field(discriminator="type"),
]


class LlmPageResponse(BaseModel):
    printedPage: str | None = None
    continuesFromPrevious: bool = False
    blocks: list[LlmBlock]
    warnings: list[str] = Field(default_factory=list)

    _normalize_printed_page = field_validator("printedPage", mode="before")(
        _printed_page
    )
