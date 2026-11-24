"""Printed table of contents → unit outline for extraction hints."""

from __future__ import annotations

import re
from typing import Any

# Mirrors packages/shared-types/src/contents.ts

_TITLE_NUMBER = re.compile(
    r"^((?:§\s*\d+\.?|(?:[IVXLCІХ]+|\d+)\.)(?:\s*\d+\.)*)\s*(.*)$",
    re.IGNORECASE | re.DOTALL,
)
_CONTENTS_LINE = re.compile(
    r"^(\s*)(.+?)(?:\s*(?:\.{2,}|…|\s{2,})\s*)(\d+[a-zа-я]?)\s*$",
    re.IGNORECASE,
)
_CONTENTS_HEADING = re.compile(
    r"^(мазмуну|содержание|оглавление|contents)$",
    re.IGNORECASE,
)


def _clean_title(raw: str) -> str:
    return " ".join(raw.split()).strip()


def _infer_heading_level(title: str) -> int:
    match = _TITLE_NUMBER.match(title.strip())
    number = match.group(1) if match else ""
    if not number:
        return 2
    if number.lstrip().startswith("§"):
        return 2
    parts = [part for part in number.split(".") if part.strip()]
    if not parts:
        return 2
    return min(6, max(1, len(parts)))


def _nest_level(title: str, indent: int, previous: list[dict[str, Any]]) -> int:
    match = _TITLE_NUMBER.match(title)
    number = match.group(1) if match else ""
    parts = [part for part in number.split(".") if part.strip()] if number else []

    if indent >= 2:
        return min(6, max(2, len(parts) or 2))

    if not number:
        return 2
    if number.lstrip().startswith("§"):
        return 2
    if len(parts) >= 2:
        return min(6, len(parts))

    arabic = bool(parts and parts[0].isdigit())
    if arabic and any(entry["level"] == 1 for entry in reversed(previous)):
        return 2
    return _infer_heading_level(title)


def _collect_text(blocks: list[Any]) -> str:
    parts: list[str] = []
    for block in blocks:
        data = block if isinstance(block, dict) else {}
        block_type = data.get("type")
        if block_type == "markdown":
            parts.append(str(data.get("markdown") or ""))
        elif block_type == "unit_header":
            parts.append(str(data.get("title") or ""))
        elif block_type == "table":
            cells = [
                str(cell.get("text") or "")
                for row in data.get("rows") or []
                if isinstance(row, dict)
                for cell in row.get("cells") or []
                if isinstance(cell, dict)
            ]
            parts.append(" ".join([str(data.get("caption") or ""), *cells]))
    return "\n".join(part for part in parts if part)


def parse_contents_text(text: str) -> list[dict[str, Any]]:
    """Titles, levels, and printed pages from contents page text."""
    entries: list[dict[str, Any]] = []
    for raw_line in text.splitlines():
        line = raw_line.replace("\u00a0", " ")
        match = _CONTENTS_LINE.match(line)
        if not match:
            continue
        indent = len(match.group(1) or "")
        title = _clean_title(match.group(2) or "")
        printed = (match.group(3) or "").strip()
        if not title or not printed:
            continue
        if _CONTENTS_HEADING.match(title):
            continue
        entries.append(
            {
                "title": title,
                "level": _nest_level(title, indent, entries),
                "printedPage": printed,
            }
        )
    return entries


def _manual_outline(book: dict[str, Any]) -> list[dict[str, Any]] | None:
    """A contents list an admin saved by hand, when it has real rows."""
    stored = book.get("contents_outline")
    if not isinstance(stored, list) or not stored:
        return None
    entries: list[dict[str, Any]] = []
    for item in stored:
        if not isinstance(item, dict):
            return None
        title = str(item.get("title") or "").strip()
        printed = str(item.get("printedPage") or "").strip()
        level = item.get("level")
        if not title or not printed or not isinstance(level, int) or not 1 <= level <= 6:
            return None
        entries.append({"title": title, "level": level, "printedPage": printed})
    return entries or None


def _entries_from_extracted(extracted: dict[str, Any]) -> list[dict[str, Any]]:
    """Prefer structured tocEntries; fall back to parsing page text."""
    raw_entries = extracted.get("tocEntries")
    if isinstance(raw_entries, list) and raw_entries:
        entries: list[dict[str, Any]] = []
        for item in raw_entries:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            printed = str(item.get("printedPage") or "").strip()
            level = item.get("level")
            if (
                not title
                or not printed
                or not isinstance(level, int)
                or not 1 <= level <= 6
            ):
                continue
            entries.append({"title": title, "level": level, "printedPage": printed})
        if entries:
            return entries
    blocks = extracted.get("blocks")
    if not isinstance(blocks, list):
        return []
    return parse_contents_text(_collect_text(blocks))


def load_contents_outline(
    book: dict[str, Any],
    pages: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    """The saved list, or the parsed contents pages when those are digitized."""
    manual = _manual_outline(book)
    if manual:
        return manual

    # Prefer pages marked table_of_contents.
    toc_pages = [
        page
        for page in pages
        if page.get("page_role") == "table_of_contents"
    ]
    if toc_pages:
        toc_pages = sorted(toc_pages, key=lambda page: int(page["page_number"]))
        entries: list[dict[str, Any]] = []
        for page in toc_pages:
            extracted = page.get("extracted_json")
            if not isinstance(extracted, dict):
                return None
            entries.extend(_entries_from_extracted(extracted))
        return entries or None

    # Legacy: contents_page_start / contents_page_end range.
    start = book.get("contents_page_start")
    end = book.get("contents_page_end")
    if start is None or end is None:
        return None
    try:
        start_n = int(start)
        end_n = int(end)
    except (TypeError, ValueError):
        return None
    if start_n < 1 or end_n < start_n:
        return None

    by_number = {int(page["page_number"]): page for page in pages}
    entries = []
    for page_number in range(start_n, end_n + 1):
        page = by_number.get(page_number)
        if not page:
            return None
        extracted = page.get("extracted_json")
        if not isinstance(extracted, dict):
            return None
        entries.extend(_entries_from_extracted(extracted))

    return entries or None


def collect_toc_from_job_pages(
    pages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge tocEntries from extracted TOC pages in page order."""
    toc_pages = sorted(
        (
            page
            for page in pages
            if page.get("page_role") == "table_of_contents"
            and isinstance(page.get("extracted_json"), dict)
        ),
        key=lambda page: int(page["page_number"]),
    )
    entries: list[dict[str, Any]] = []
    for page in toc_pages:
        entries.extend(_entries_from_extracted(page["extracted_json"]))
    return entries


def prompt_hint(entries: list[dict[str, Any]]) -> str:
    """Short note for the page extraction prompt."""
    if not entries:
        return ""
    lines = [
        "The book's table of contents lists these titles. "
        "Only these titles are unit_header blocks; use the given level. "
        "Every other heading stays inside markdown:"
    ]
    for entry in entries:
        lines.append(
            f'- level {entry["level"]}: {entry["title"]} (printed page {entry["printedPage"]})'
        )
    return "\n".join(lines)
