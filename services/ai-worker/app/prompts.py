"""Role-specific extraction prompts for page digitization."""

from __future__ import annotations

from typing import Any

PAGE_ROLES = (
    "body",
    "table_of_contents",
    "cover",
    "glossary",
    "appendix",
    "answers",
)

_SHARED_HEADER = """You are a textbook OCR and layout extractor.
Transcribe the page. Do NOT translate.
Preserve Kyrgyz letters exactly: Ө ө Ү ү Ң ң and Russian Cyrillic.
Return JSON only.
Do not invent missing content. Leave out running headers and footers.
"""

_TABLE_CHOICE = """
Tables — decide for every printed table before emitting it:
1. Review the grid. Ask whether GitHub-flavored Markdown can represent it
   faithfully: one header row, a rectangular body, every cell on one line,
   and no merged cells.
2. If yes, put a Markdown table inside a markdown block.
3. If not, emit a {"type": "table", ...} component. Do NOT force a complex
   table into Markdown pipes, and do not invent a flattened grid that drops
   spans or stacked headers.

Use type "table" (not Markdown) when any of these is true:
- a cell spans columns or rows (colspan / rowspan)
- a header cell breaks onto a second printed line
- a heading sits above subheadings (grouped / stacked headers)
- the printed layout is irregular and a pipe table would lose structure

Markdown tables are only for simple rectangular grids. When the page opens
with the rest of a simple Markdown table begun on the previous page, give it
an empty header row (| | | |) so that no data row is turned into a header.
"""

_BODY_BLOCKS = """
The page is continuous Markdown interrupted only by components. Do NOT make one
block per paragraph or per heading.

Block types, in reading order:
- {"type": "markdown", "markdown": "..."}
  All prose between two components goes in ONE markdown block: paragraphs
  separated by a blank line, headings as #, ## or ###, lists, and only those
  tables that Markdown can represent (see Tables below). Definitions, examples
  and exercises are plain Markdown too.
- {"type": "table", "idInBook": "1-таблица" | null,
   "caption": "Республиканын калкынын саны" | null, "rows": [
    {"header": true, "cells": [{"text": "Жылы", "rowspan": 2},
      {"text": "Анын ичинен", "colspan": 2}]},
    {"header": true, "cells": [{"text": "шаар калкы"}, {"text": "айыл калкы"}]},
    {"header": false, "cells": [{"text": "1897"}, {"text": "63,0"}, {"text": "600,0"}]}
  ]}
  The structured table component for grids Markdown cannot carry. idInBook is
  the printed table number/label alone (e.g. "6-таблица", "Таблица 6"), or
  null when the table has none. caption is the descriptive title without that
  number, or null. colspan and rowspan are omitted when the cell does not
  span. Do not repeat the grid in the markdown.
- {"type": "image", "box_2d": [ymin, xmin, ymax, xmax],
   "alt": "...", "ai_description": "...", "caption": "..." | null}
  One per map, diagram, photo or chart, placed exactly where it appears between
  the text. box_2d is the tight bounding box of the whole picture on the page,
  on a 0-1000 scale, without its caption. alt and ai_description are written in
  the book language; caption is the printed caption, if any.
- {"type": "unit_header", "title": "...", "level": 1}
  Only where a chapter or a numbered lesson/section of the book begins: a title
  the book's own table of contents would list (for example "II. ...",
  "II. 3. ..." or "§ 3. ..."). level is 1 to 6: 1 a part or chapter ("II. ..."),
  2 a lesson ("II. 1. ..." or "§ 3. ..."), 3 to 6 a subsection under that
  lesson. Write the title in one line, with its number, in normal sentence
  capitalization even when it is printed in capitals. The title goes here and
  is NOT repeated in the markdown. When a chapter title is followed by the
  title of its first section, they are two unit_header blocks, the chapter at
  level 1 and the section at level 2. Every other heading (an unnumbered
  subheading, "questions and tasks", table titles) stays inside markdown.
""" + _TABLE_CHOICE + """
Page fields:
- printedPage: the page number printed on the page, exactly as printed, or null
  when the page carries none. This is not the position in the PDF.
- continuesFromPrevious: true only when the page opens in the middle of a
  sentence or paragraph carried over from the previous page.
"""

_NO_UNIT_HEADER = """
Do NOT emit unit_header blocks on this page. Numbered lines, § markers, and
chapter-like titles stay inside markdown (or tocEntries for a table of contents).
"""

_MARKDOWN_IMAGE_TABLE = """
Allowed block types only:
- {"type": "markdown", "markdown": "..."}
- {"type": "table", "idInBook": "..." | null, "caption": "..." | null, "rows": [...]}
- {"type": "image", "box_2d": [ymin, xmin, ymax, xmax], "alt": "...",
   "ai_description": "...", "caption": "..." | null}
""" + _TABLE_CHOICE + """
Page fields:
- printedPage: the page number printed on the page, or null when none.
- continuesFromPrevious: usually false for these pages.
"""


def _book_context(*, title: str, language: str, grade: int | None) -> str:
    grade_bit = f", grade {grade}" if grade is not None else ""
    return f"Book: {title} (language={language}{grade_bit})."


def body_prompt(*, title: str, language: str, grade: int | None, toc_hint: str = "") -> str:
    parts = [
        _SHARED_HEADER,
        _book_context(title=title, language=language, grade=grade),
        "This is a BODY (lesson) page.",
        'Return JSON in this shape: {"printedPage": "42" | null, '
        '"continuesFromPrevious": true | false, "blocks": [ ... ], "warnings": []}',
        _BODY_BLOCKS,
    ]
    if toc_hint.strip():
        parts.append(toc_hint.strip())
    return "\n".join(parts)


def toc_prompt(*, title: str, language: str, grade: int | None) -> str:
    return "\n".join(
        [
            _SHARED_HEADER,
            _book_context(title=title, language=language, grade=grade),
            "This page is the book's TABLE OF CONTENTS (мазмуну / содержание / оглавление).",
            "Extract every contents line as structured entries AND readable Markdown.",
            _NO_UNIT_HEADER,
            """Return JSON in this shape:
{
  "printedPage": null | "…",
  "continuesFromPrevious": false,
  "tocEntries": [
    {"title": "I. Chapter title", "level": 1, "printedPage": "4"},
    {"title": "1. Lesson title", "level": 2, "printedPage": "4"}
  ],
  "blocks": [
    {"type": "markdown", "markdown": "# Мазмуну\\n\\n…"}
  ],
  "warnings": []
}

Rules for tocEntries:
- One entry per contents line that ends with a printed page number.
- Strip dot leaders (........), ellipsis, and extra spaces between title and page.
- level is 1–6 from indentation and numbering: Roman chapters ("I.", "II.") are 1;
  lessons ("1.", "§ 3.", "II. 1.") are 2; deeper numbers are 3–6.
- Titles in one line, sentence capitalization even when printed in capitals.
- Skip the word "Мазмуну" / "Содержание" / "Contents" itself as an entry.
- Preserve Kyrgyz and Russian letters exactly.

Also put a clean readable Markdown rendering of the same list in blocks
(no unit_header). Prefer a simple list or indented lines without long dot leaders.
""",
            _MARKDOWN_IMAGE_TABLE,
        ]
    )


def cover_prompt(*, title: str, language: str, grade: int | None) -> str:
    return "\n".join(
        [
            _SHARED_HEADER,
            _book_context(title=title, language=language, grade=grade),
            "This is a COVER / title page.",
            _NO_UNIT_HEADER,
            """Return JSON in this shape:
{
  "printedPage": null | "…",
  "continuesFromPrevious": false,
  "coverMeta": {
    "title": "…",
    "authors": ["…"],
    "publishedYear": 2024,
    "publisher": "…"
  },
  "blocks": [
    {"type": "markdown", "markdown": "# Title\\n\\nAuthors\\n\\nYear · Publisher"}
  ],
  "warnings": []
}

Extract title, subtitle, authors, publication year, publisher, and any
edition or ministry approval note as clean Markdown. coverMeta fields that
are not printed may be omitted. Put any emblem/photo as an image block.
""",
            _MARKDOWN_IMAGE_TABLE,
        ]
    )


def glossary_prompt(*, title: str, language: str, grade: int | None) -> str:
    return "\n".join(
        [
            _SHARED_HEADER,
            _book_context(title=title, language=language, grade=grade),
            "This is a GLOSSARY page (глоссарий / сөздүк / словарь).",
            _NO_UNIT_HEADER,
            """Return JSON with printedPage, continuesFromPrevious, blocks, warnings.

Format each term as Markdown in the book language, for example:
**Термин** — аныктамасы.

Preserve letter-group subheadings (### А) when printed. Keep definitions in
the book language; do not translate.
""",
            _MARKDOWN_IMAGE_TABLE,
        ]
    )


def appendix_prompt(*, title: str, language: str, grade: int | None) -> str:
    return "\n".join(
        [
            _SHARED_HEADER,
            _book_context(title=title, language=language, grade=grade),
            "This is an APPENDIX page (тиркеме / приложение).",
            _NO_UNIT_HEADER,
            """Return JSON with printedPage, continuesFromPrevious, blocks, warnings.

Preserve reference tables (table block for merged/stacked headers, GFM table
for simple grids), reference maps/diagrams (image block), and explanatory
notes in reading order. Keep printed appendix titles (Тиркеме 1. … /
Приложение 1. …) as Markdown ## headings, not unit_header blocks.
""",
            _MARKDOWN_IMAGE_TABLE,
        ]
    )


def answers_prompt(*, title: str, language: str, grade: int | None) -> str:
    return "\n".join(
        [
            _SHARED_HEADER,
            _book_context(title=title, language=language, grade=grade),
            "This is an ANSWERS / answer-key page (жооптор / ответы).",
            _NO_UNIT_HEADER,
            """Return JSON with printedPage, continuesFromPrevious, blocks, warnings.

Format exercise/test keys as GFM Markdown tables when compact, for example:
| § / Exercise | Answer |
| --- | --- |
| 1 | 14 |

Or as grouped lists under ### § N headings when answers are short explanations.
Never emit unit_header when a line starts with § or a chapter number — those
are answer labels, not lesson openings.
""",
            _MARKDOWN_IMAGE_TABLE,
        ]
    )


def _with_instruction(prompt: str, instruction: str = "") -> str:
    note = instruction.strip()
    if not note:
        return prompt
    return "\n".join(
        [
            prompt,
            "Reviewer note for this page only. Use it to correct the reading. "
            "Keep the JSON shape above.",
            note,
        ]
    )


def prompt_for_role(
    role: str,
    *,
    title: str,
    language: str,
    grade: int | None = None,
    toc_hint: str = "",
    instruction: str = "",
) -> str:
    """The full system/user prompt text for this page role."""
    if role == "table_of_contents":
        base = toc_prompt(title=title, language=language, grade=grade)
    elif role == "cover":
        base = cover_prompt(title=title, language=language, grade=grade)
    elif role == "glossary":
        base = glossary_prompt(title=title, language=language, grade=grade)
    elif role == "appendix":
        base = appendix_prompt(title=title, language=language, grade=grade)
    elif role == "answers":
        base = answers_prompt(title=title, language=language, grade=grade)
    else:
        base = body_prompt(
            title=title, language=language, grade=grade, toc_hint=toc_hint
        )
    return _with_instruction(base, instruction)


def normalize_toc_entries(raw: Any) -> list[dict[str, Any]]:
    """Validate tocEntries from the model into {title, level, printedPage}."""
    if not isinstance(raw, list):
        return []
    entries: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = item.get("title")
        printed = item.get("printedPage")
        level = item.get("level")
        if not isinstance(title, str) or not title.strip():
            continue
        if not isinstance(printed, (str, int)) or not str(printed).strip():
            continue
        level_n = int(level) if isinstance(level, (int, float, str)) and str(level).isdigit() else 2
        if level_n < 1 or level_n > 6:
            level_n = 2
        entries.append(
            {
                "title": " ".join(title.split()).strip(),
                "level": level_n,
                "printedPage": str(printed).strip(),
            }
        )
    return entries


def normalize_cover_meta(raw: Any) -> dict[str, Any] | None:
    """Optional coverMeta object, or None when empty/unusable."""
    if not isinstance(raw, dict):
        return None
    meta: dict[str, Any] = {}
    title = raw.get("title")
    if isinstance(title, str) and title.strip():
        meta["title"] = title.strip()
    authors = raw.get("authors")
    if isinstance(authors, list):
        names = [str(name).strip() for name in authors if str(name).strip()]
        if names:
            meta["authors"] = names
    year = raw.get("publishedYear")
    if isinstance(year, int) and 1000 <= year <= 9999:
        meta["publishedYear"] = year
    elif isinstance(year, str) and year.isdigit() and 1000 <= int(year) <= 9999:
        meta["publishedYear"] = int(year)
    publisher = raw.get("publisher")
    if isinstance(publisher, str) and publisher.strip():
        meta["publisher"] = publisher.strip()
    return meta or None
