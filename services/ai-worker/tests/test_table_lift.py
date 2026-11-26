from __future__ import annotations

import json

from app.llm import parse_page_response
from app.table_lift import lift_complex_tables

PAGE = """Кыргыз Республикасында 2009-ж. 5418,3 млн калк жашаган.

1-таблица

Республиканын калкынын саны

| Жылы | Калктын саны
(миң киши) | Анын ичинен |
| --- | --- | --- | --- |
| | | шаар калкы | айыл калкы |
| 1897 | 663,0 | 63,0 | 600,0 |
| 2009 | 5418,3 | 1846,8 | 3571,5 |

Калк санындагы эң жогорку өсүш 1950-жылдардан кийин болду."""


def test_leaves_a_simple_markdown_table() -> None:
    markdown = (
        "## Борбор шаарлар\n\n| Өлкө | Борбор |\n| --- | --- |\n| Кыргызстан | Бишкек |"
    )
    assert lift_complex_tables(markdown) == [{"kind": "markdown", "markdown": markdown}]


def test_lifts_a_stacked_header_table() -> None:
    pieces = lift_complex_tables(PAGE)
    assert [piece["kind"] for piece in pieces] == ["markdown", "table", "markdown"]
    table = pieces[1]
    assert table["caption"] == "1-таблица. Республиканын калкынын саны"
    assert table["rows"][0] == {
        "header": True,
        "cells": [
            {"text": "Жылы", "rowspan": 2},
            {"text": "Калктын саны (миң киши)", "rowspan": 2},
            {"text": "Анын ичинен", "colspan": 2},
        ],
    }
    assert table["rows"][1] == {
        "header": True,
        "cells": [{"text": "шаар калкы"}, {"text": "айыл калкы"}],
    }
    assert [cell["text"] for cell in table["rows"][2]["cells"]] == [
        "1897",
        "663,0",
        "63,0",
        "600,0",
    ]


def test_parse_page_response_lifts_complex_markdown_tables() -> None:
    content = json.dumps(
        {
            "printedPage": "39",
            "continuesFromPrevious": False,
            "blocks": [{"type": "markdown", "markdown": PAGE}],
            "warnings": [],
        }
    )
    page = parse_page_response(content, page_role="body")
    types = [block.type for block in page.blocks]
    assert "table" in types
    table = next(block for block in page.blocks if block.type == "table")
    assert table.caption == "1-таблица. Республиканын калкынын саны"
