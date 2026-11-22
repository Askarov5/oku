from __future__ import annotations

import json
from pathlib import Path

from app.models import LlmPageResponse, PageExtractedJson

FIXTURE = Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "fixtures" / "sample-page.json"


def test_shared_fixture_parses_in_pydantic() -> None:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    parsed = PageExtractedJson.model_validate(payload)
    assert parsed.pageNumber == 1
    assert parsed.printedPage == "5"
    assert [block.type for block in parsed.blocks] == [
        "unit_header",
        "markdown",
        "image",
        "markdown",
    ]


def test_dump_keeps_the_keys_the_shared_schema_requires() -> None:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["printedPage"] = None
    dumped = PageExtractedJson.model_validate(payload).model_dump(mode="json")
    assert "printedPage" in dumped
    assert dumped["continuesFromPrevious"] is False


def test_llm_response_tolerates_numeric_page_and_missing_ids() -> None:
    parsed = LlmPageResponse.model_validate(
        {
            "printedPage": 42,
            "blocks": [
                {"type": "markdown", "markdown": "Text"},
                {
                    "type": "image",
                    "bbox": {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
                },
            ],
        }
    )
    assert parsed.printedPage == "42"
    assert all(block.id for block in parsed.blocks)
