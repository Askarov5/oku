from __future__ import annotations

import json

import pytest

from app.config import settings
from app.llm import (
    UnusableResponse,
    normalize_title,
    parse_page_response,
    resolve_model,
    retry_delay,
)


def _answer(**fields: object) -> str:
    return json.dumps({"printedPage": "42", "blocks": [], **fields})


def test_parses_the_shape_we_ask_for() -> None:
    page = parse_page_response(
        _answer(
            continuesFromPrevious=True,
            blocks=[
                {"type": "unit_header", "title": "II. 3.  Калктын  курамы"},
                {"type": "markdown", "markdown": "Текст Ө ү ң."},
                {
                    "type": "image",
                    "bbox": {"x": 0.1, "y": 0.2, "w": 0.5, "h": 0.3},
                    "alt": "Карта",
                    "ai_description": "Калктын жыштыгы.",
                    "caption": "",
                },
            ],
        )
    )
    assert page.printedPage == "42"
    assert page.continuesFromPrevious is True
    assert [block.type for block in page.blocks] == ["unit_header", "markdown", "image"]
    assert page.blocks[0].title == "II. 3. Калктын курамы"
    assert page.blocks[2].caption is None
    assert page.warnings == []


@pytest.mark.parametrize(
    ("printed", "expected"),
    [
        # Capitals become sentence case; the number is kept.
        (
            "V. 3. АЙЫЛ ЧАРБА ПРОДУКЦИЯЛАРЫН КАЙРА ИШТЕТҮҮЧҮ ӨНӨР ЖАЙЛАРЫ",
            "V. 3. Айыл чарба продукцияларын кайра иштетүүчү өнөр жайлары",
        ),
        ("I. КЫРГЫЗСТАНДЫН ГЕОГРАФИЯСЫ", "I. Кыргызстандын географиясы"),
        ("МАЗМУНУ", "Мазмуну"),
        # Cyrillic look-alikes in the numeral become Latin.
        ("І. 1. Кыргызстандын географиялык абалы", "I. 1. Кыргызстандын географиялык абалы"),
        ("ІХ. 2. Чүй облусу", "IX. 2. Чүй облусу"),
        # A title already in sentence case is left alone, including one that
        # starts with a letter that could pass for a numeral.
        ("Химия өнөр жайы", "Химия өнөр жайы"),
        ("§ 3. Калктын курамы", "§ 3. Калктын курамы"),
    ],
)
def test_titles_read_as_in_a_table_of_contents(printed: str, expected: str) -> None:
    assert normalize_title(printed) == expected


def test_a_numbered_heading_left_in_markdown_becomes_a_unit_header() -> None:
    page = parse_page_response(
        _answer(
            blocks=[
                {
                    "type": "markdown",
                    "markdown": (
                        "Мурунку бөлүмдүн аягы.\n\n"
                        "### **І. 1. КЫРГЫЗСТАНДЫН ГЕОГРАФИЯЛЫК АБАЛЫ**\n\n"
                        "Кыргызстан – эгемендүү өлкө.\n\n"
                        "### Суроолор жана тапшырмалар\n\n"
                        "1. Биринчи суроо."
                    ),
                }
            ]
        )
    )
    assert [block.type for block in page.blocks] == ["markdown", "unit_header", "markdown"]
    assert page.blocks[0].markdown == "Мурунку бөлүмдүн аягы."
    assert page.blocks[1].title == "I. 1. Кыргызстандын географиялык абалы"
    # An unnumbered heading and a numbered list stay where they are.
    assert page.blocks[2].markdown.startswith("Кыргызстан – эгемендүү өлкө.")
    assert "### Суроолор жана тапшырмалар" in page.blocks[2].markdown


def test_a_printed_table_of_contents_does_not_open_units() -> None:
    page = parse_page_response(
        _answer(
            blocks=[
                {
                    "type": "markdown",
                    "markdown": "# Мазмуну\n\n## I. Кыргызстандын географиясы ........ 4\n\nI. 1. Абалы ........ 4",
                }
            ]
        )
    )
    assert [block.type for block in page.blocks] == ["markdown"]


def test_accepts_the_models_native_box() -> None:
    # [ymin, xmin, ymax, xmax] on a 0..1000 scale.
    page = parse_page_response(
        _answer(blocks=[{"type": "image", "box_2d": [200, 100, 500, 600]}])
    )
    box = page.blocks[0].bbox
    assert (box.x, box.y) == (0.1, 0.2)
    assert box.w == pytest.approx(0.5)
    assert box.h == pytest.approx(0.3)


def test_keeps_a_box_inside_the_page() -> None:
    page = parse_page_response(
        _answer(blocks=[{"type": "image", "bbox": {"x": 0.6, "y": -0.1, "w": 0.9, "h": 0.5}}])
    )
    box = page.blocks[0].bbox
    assert box.y == 0
    assert box.x + box.w <= 1


def test_drops_an_image_without_a_box_and_says_so() -> None:
    page = parse_page_response(
        _answer(blocks=[{"type": "markdown", "markdown": "Текст"}, {"type": "image", "alt": "Карта"}])
    )
    assert [block.type for block in page.blocks] == ["markdown"]
    assert page.warnings and page.warnings[0].startswith("image_without_box")


def test_keeps_text_from_block_types_we_did_not_ask_for() -> None:
    page = parse_page_response(_answer(blocks=[{"type": "paragraph", "text": "Текст"}]))
    assert page.blocks[0].type == "markdown"
    assert page.blocks[0].markdown == "Текст"


def test_a_bare_list_of_blocks_and_code_fences_are_fine() -> None:
    content = "```json\n" + json.dumps([{"type": "markdown", "markdown": "Текст"}]) + "\n```"
    page = parse_page_response(content)
    assert page.printedPage is None
    assert len(page.blocks) == 1


def test_an_escape_json_does_not_have_is_repaired() -> None:
    # As returned by the model: \' and \° are not JSON escapes; \" and \\ are.
    content = (
        '{"printedPage": "4", "blocks": [{"type": "markdown", '
        '"markdown": "43\\°16\\\' жана \\"Ысык-Көл\\" C:\\\\ жол"}]}'
    )
    with pytest.raises(json.JSONDecodeError):
        json.loads(content)
    page = parse_page_response(content)
    assert page.blocks[0].markdown == "43°16' жана \"Ысык-Көл\" C:\\ жол"


def test_a_blank_page_is_a_page() -> None:
    assert parse_page_response(_answer(printedPage=None)).blocks == []


@pytest.mark.parametrize("content", ["not json", '"just a string"', '{"printedPage": "1"}'])
def test_unusable_answers_ask_for_a_retry(content: str) -> None:
    with pytest.raises(UnusableResponse):
        parse_page_response(content)


def test_the_admins_model_is_used_for_a_job() -> None:
    assert resolve_model("gemini/gemini-3.8-flash") == "gemini/gemini-3.8-flash"


@pytest.mark.parametrize(
    "saved", [None, "", 7, {"model": "x"}, "openai/gpt-5", "gemini/Gemini 3.8", "gemini-3.8-flash"]
)
def test_without_a_usable_saved_model_the_worker_default_is_used(saved: object) -> None:
    assert resolve_model(saved) == settings.llm_model


def test_retry_delay_follows_the_service_hint() -> None:
    assert retry_delay(Exception("Quota exceeded. Please retry in 34.5s."), 1) == 35.5
    assert retry_delay(Exception('"retryDelay": "12s"'), 1) == 13.0


def test_retry_delay_grows_without_a_hint() -> None:
    first = retry_delay(Exception("overloaded"), 1)
    third = retry_delay(Exception("overloaded"), 3)
    assert 5 <= first <= 7
    assert 20 <= third <= 22
