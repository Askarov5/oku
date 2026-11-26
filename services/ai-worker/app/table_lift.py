"""Pull complex pipe tables out of Markdown into structured table blocks.

Mirrors packages/shared-types/src/table-lift.ts so a model that still emits a
complex grid as GFM does not leave it stuck in Markdown.
"""

from __future__ import annotations

import re
from typing import Any

_DELIMITER = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


def _split_row(line: str) -> list[str]:
    trimmed = re.sub(r"\s+", " ", line.strip())
    body = trimmed[1:] if trimmed.startswith("|") else trimmed
    if body.endswith("|"):
        body = body[:-1]
    return [cell.strip() for cell in body.split("|")]


def _row_closed(line: str) -> bool:
    trimmed = line.strip()
    return trimmed.startswith("|") and trimmed.endswith("|")


def _pad(cells: list[str], columns: int) -> list[str]:
    next_cells = cells[:columns]
    while len(next_cells) < columns:
        next_cells.append("")
    return next_cells


def _is_subheader(cells: list[str]) -> bool:
    filled = [cell.strip() for cell in cells if cell.strip()]
    if not filled or len(filled) == len(cells):
        return False
    return all(not cell[0].isdigit() for cell in filled if cell)


def _span(count: int, key: str) -> dict[str, int]:
    return {key: count} if count > 1 else {}


def _take_header(
    lines: list[str], delimiter: int
) -> dict[str, Any] | None:
    end = delimiter - 1
    while end >= 0 and not (lines[end] or "").strip():
        end -= 1
    if end < 0:
        return None
    last = lines[end] or ""
    if "|" not in last:
        return None
    collected = [last]
    start = end
    while not _row_closed(" ".join(collected)) and start > 0:
        previous = lines[start - 1] or ""
        if not previous.strip():
            break
        collected.insert(0, previous)
        start -= 1
    return {
        "start": start,
        "cells": _split_row(" ".join(collected)),
        "wrapped": len(collected) > 1,
    }


def _take_body(lines: list[str], start: int) -> dict[str, Any]:
    rows: list[list[str]] = []
    index = start
    while index < len(lines):
        line = lines[index] or ""
        if (
            not line.strip()
            or "|" not in line
            or _DELIMITER.match(line)
        ):
            break
        chunk = [line]
        cursor = index
        while not _row_closed(" ".join(chunk)) and cursor + 1 < len(lines):
            nxt = lines[cursor + 1] or ""
            if not nxt.strip() or _DELIMITER.match(nxt):
                break
            chunk.append(nxt)
            cursor += 1
        rows.append(_split_row(" ".join(chunk)))
        index = cursor + 1
    return {"rows": rows, "end": index}


def _take_caption(
    lines: list[str], header_start: int
) -> dict[str, Any]:
    picked: list[str] = []
    cursor = header_start
    while len(picked) < 2:
        index = cursor - 1
        while index >= 0 and not (lines[index] or "").strip():
            index -= 1
        if index < 0:
            break
        line = (lines[index] or "").strip()
        if (
            not line
            or "|" in line
            or line.startswith("#")
            or len(line) > 80
        ):
            break
        picked.insert(0, line)
        cursor = index
    if not picked:
        return {"start": header_start, "text": None}
    text_parts: list[str] = []
    for i, line in enumerate(picked):
        if i == 0 and len(picked) > 1 and not re.search(r"[.!?…]$", line):
            text_parts.append(f"{line}.")
        else:
            text_parts.append(line)
    return {"start": cursor, "text": " ".join(text_parts)}


def _header_rows(
    top: list[str], sub: list[str] | None, columns: int
) -> list[dict[str, Any]]:
    cells: list[dict[str, Any]] = []
    column = 0
    while column < columns:
        text = top[column] if column < len(top) else ""
        if not text:
            column += 1
            continue
        width = 1
        while (
            column + width < columns
            and not (top[column + width] if column + width < len(top) else "").strip()
        ):
            width += 1
        below = (
            [
                (sub[column + offset] if column + offset < len(sub) else "").strip()
                for offset in range(width)
            ]
            if sub is not None
            else []
        )
        stacked = sub is not None and width == 1 and all(cell == "" for cell in below)
        cell: dict[str, Any] = {"text": text}
        cell.update(_span(2, "rowspan") if stacked else _span(width, "colspan"))
        cells.append(cell)
        column += width
    rows: list[dict[str, Any]] = [{"header": True, "cells": cells}]
    if sub is not None:
        rows.append(
            {
                "header": True,
                "cells": [{"text": text} for text in sub if text.strip()],
            }
        )
    return rows


def lift_complex_tables(markdown: str) -> list[dict[str, Any]]:
    """Pull a pipe table GFM cannot draw out of Markdown.

    A table with one header row and no wrapped cell stays in the Markdown.
    """
    lines = markdown.split("\n")
    pieces: list[dict[str, Any]] = []
    cursor = 0
    lifted = False

    def push_markdown(from_i: int, to_i: int) -> None:
        text = "\n".join(lines[from_i:to_i]).strip()
        if text:
            pieces.append({"kind": "markdown", "markdown": text})

    index = 0
    while index < len(lines):
        if not _DELIMITER.match(lines[index] or ""):
            index += 1
            continue
        columns = len(_split_row(lines[index] or ""))
        header = _take_header(lines, index)
        if not header:
            index += 1
            continue
        body = _take_body(lines, index + 1)
        padded_header = _pad(header["cells"], columns)
        first_body = body["rows"][0] if body["rows"] else None
        sub = (
            _pad(first_body, columns)
            if first_body is not None and _is_subheader(_pad(first_body, columns))
            else None
        )
        if (
            not header["wrapped"]
            and len(header["cells"]) == columns
            and sub is None
        ):
            index += 1
            continue
        caption = _take_caption(lines, header["start"])
        push_markdown(cursor, caption["start"])
        data = body["rows"][1:] if sub is not None else body["rows"]
        pieces.append(
            {
                "kind": "table",
                "caption": caption["text"],
                "rows": [
                    *_header_rows(padded_header, sub, columns),
                    *[
                        {
                            "header": False,
                            "cells": [{"text": text} for text in _pad(cells, columns)],
                        }
                        for cells in data
                    ],
                ],
            }
        )
        lifted = True
        cursor = body["end"]
        index = body["end"]

    if not lifted:
        return [{"kind": "markdown", "markdown": markdown}]
    push_markdown(cursor, len(lines))
    return pieces
