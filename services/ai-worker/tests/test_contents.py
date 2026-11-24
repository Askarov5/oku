from __future__ import annotations

from app.contents import load_contents_outline, parse_contents_text, prompt_hint


def test_parse_contents_text_nests_restarted_lessons() -> None:
    entries = parse_contents_text(
        "\n".join(
            [
                "Мазмуну",
                "I. Кыргызстандын географиясы ........ 4",
                "  1. Абалы ........ 4",
                "II. Социалдык география ........ 40",
                "II. 1. Калктын өсүшү ........ 40",
            ]
        )
    )
    assert [(entry["title"], entry["level"], entry["printedPage"]) for entry in entries] == [
        ("I. Кыргызстандын географиясы", 1, "4"),
        ("1. Абалы", 2, "4"),
        ("II. Социалдык география", 1, "40"),
        ("II. 1. Калктын өсүшү", 2, "40"),
    ]


def test_a_saved_list_is_the_outline() -> None:
    outline = load_contents_outline(
        {
            "contents_outline": [
                {"title": "I. Chapter", "level": 1, "printedPage": "4"},
            ]
        },
        [],
    )
    assert outline == [{"title": "I. Chapter", "level": 1, "printedPage": "4"}]


def test_load_contents_outline_waits_for_digitized_pages() -> None:
    book = {"contents_page_start": 222, "contents_page_end": 223}
    assert load_contents_outline(book, []) is None
    assert (
        load_contents_outline(
            book,
            [
                {
                    "page_number": 222,
                    "extracted_json": None,
                }
            ],
        )
        is None
    )


def test_load_contents_outline_parses_ready_pages() -> None:
    book = {"contents_page_start": 222, "contents_page_end": 222}
    outline = load_contents_outline(
        book,
        [
            {
                "page_number": 222,
                "extracted_json": {
                    "blocks": [
                        {
                            "type": "markdown",
                            "markdown": "I. Chapter ........ 4\nI. 1. Lesson ........ 5",
                        }
                    ]
                },
            }
        ],
    )
    assert outline is not None
    assert [entry["title"] for entry in outline] == ["I. Chapter", "I. 1. Lesson"]
    assert "unit_header" in prompt_hint(outline)


def test_load_contents_outline_prefers_page_role_and_toc_entries() -> None:
    outline = load_contents_outline(
        {},
        [
            {
                "page_number": 222,
                "page_role": "table_of_contents",
                "extracted_json": {
                    "tocEntries": [
                        {"title": "I. Chapter", "level": 1, "printedPage": "4"},
                    ],
                    "blocks": [],
                },
            }
        ],
    )
    assert outline == [{"title": "I. Chapter", "level": 1, "printedPage": "4"}]
