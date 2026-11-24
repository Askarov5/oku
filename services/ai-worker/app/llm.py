from __future__ import annotations

import base64
import io
import json
import logging
import random
import re
import time
from typing import Any

from PIL import Image

from app.config import settings
from app.models import LlmPageResponse
from app.prompts import (
    normalize_cover_meta,
    normalize_toc_entries,
    prompt_for_role,
)

logger = logging.getLogger("oku.worker")


def _image_data_url(image: Image.Image) -> str:
    """The page as the model sees it: capped in size, JPEG to keep the request small."""
    longest = max(image.size)
    limit = settings.llm_image_max_side
    if longest > limit:
        scale = limit / longest
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=90)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


# The mock lays a book out as four-page units so the unit and page-anchor
# paths get exercised without a model.
MOCK_PAGES_PER_UNIT = 4


def mock_extract(
    *,
    page_number: int,
    language: str,
    image: Image.Image,
) -> LlmPageResponse:
    _ = image
    ky = language == "ky"
    position = (page_number - 1) % MOCK_PAGES_PER_UNIT
    unit_number = (page_number - 1) // MOCK_PAGES_PER_UNIT + 1

    table = (
        "| Өлкө | Борбор |\n| --- | --- |\n| Кыргызстан | Бишкек |"
        if ky
        else "| Страна | Столица |\n| --- | --- |\n| Кыргызстан | Бишкек |"
    )
    image_block = {
        "type": "image",
        # A center rectangle stands in for a map.
        "bbox": {"x": 0.15, "y": 0.25, "w": 0.7, "h": 0.35},
        "alt": "Карта",
        "ai_description": (
            "Карта Борбордук Азия өлкөлөрүн көрсөтөт."
            if ky
            else "Карта показывает страны Центральной Азии."
        ),
        "caption": None,
    }

    blocks: list[dict[str, Any]] = []
    continues = False

    if position == 0:
        blocks.append(
            {
                "type": "unit_header",
                "title": (
                    f"§ {unit_number}. Саясий география"
                    if ky
                    else f"§ {unit_number}. Политическая география"
                ),
            }
        )
        blocks.append(
            {
                "type": "markdown",
                "markdown": (
                    "Кыргызстандын саясий географиясы Өзбекстан жана Үндүстан "
                    "менен байланыштуу."
                    if ky
                    else "Политическая география изучает государства, границы и столицы."
                ),
            }
        )
        blocks.append(image_block)
        blocks.append(
            {
                "type": "markdown",
                "markdown": (
                    f"## Борбор шаарлар\n\n{table}\n\nКартадан көрүнүп тургандай, өлкө"
                    if ky
                    else f"## Столицы\n\n{table}\n\nКак видно на карте, страна"
                ),
            }
        )
    elif position == 1:
        # Opens mid-paragraph: the sentence began on the previous page.
        continues = True
        blocks.append(
            {
                "type": "markdown",
                "markdown": (
                    "беш мамлекет менен чектешет.\n\n"
                    "## Чек аралар\n\n"
                    "Өлкөнүн чек аралары тоо кыркалары жана дарыялар боюнча өтөт."
                    if ky
                    else "граничит с пятью государствами.\n\n"
                    "## Границы\n\n"
                    "Границы страны проходят по горным хребтам и рекам."
                ),
            }
        )
    else:
        blocks.append(
            {
                "type": "markdown",
                "markdown": (
                    "## Калк жана шаарлар\n\n"
                    "Калктын көпчүлүгү өрөөндөрдө жана ири шаарларда жашайт."
                    if ky
                    else "## Население и города\n\n"
                    "Большая часть населения живёт в долинах и крупных городах."
                ),
            }
        )
        blocks.append(image_block)

    return LlmPageResponse.model_validate(
        {
            "printedPage": str(page_number),
            "continuesFromPrevious": continues,
            "blocks": blocks,
            "warnings": [],
        }
    )


# The setting an admin changes in the web app (EXTRACTION_MODEL_SETTING in @oku/db).
EXTRACTION_MODEL_SETTING = "extraction_model"

# LiteLLM provider prefix to the setting that holds that provider's key.
_PROVIDER_KEYS = {
    "gemini": "gemini_api_key",
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key",
}

_MODEL_ID = re.compile(r"(gemini|openai|anthropic)/[a-z0-9][a-z0-9.-]{1,79}")


def provider_api_key(model: str) -> str:
    """The key for this LiteLLM id, or empty when that provider is not configured."""
    provider = model.split("/", 1)[0]
    attr = _PROVIDER_KEYS.get(provider)
    if attr is None:
        return ""
    value = getattr(settings, attr, "")
    return value.strip() if isinstance(value, str) else ""


def _redact(text: str) -> str:
    redacted = text
    for attr in _PROVIDER_KEYS.values():
        key = getattr(settings, attr, "")
        if isinstance(key, str) and key:
            redacted = redacted.replace(key, "***")
    return redacted


def uses_mock(model: str | None = None) -> bool:
    if settings.mock_llm:
        return True
    return not provider_api_key(model or settings.llm_model)


def resolve_model(saved: Any) -> str:
    """The model for a job: the admin's choice, else the worker's own default.

    Gemini ids are accepted as before. Another provider is used only when its
    API key is set; otherwise the worker default runs.
    """
    if isinstance(saved, str) and _MODEL_ID.fullmatch(saved):
        provider = saved.split("/", 1)[0]
        if provider == "gemini" or provider_api_key(saved):
            return saved
    return settings.llm_model


def model_name(model: str | None = None) -> str:
    """What produced a page, as recorded on it."""
    target = model or settings.llm_model
    return "mock" if uses_mock(target) else target


class UnusableResponse(ValueError):
    """The model answered, but not with a page we can store. Worth asking again."""


def _normalize_box(raw: Any) -> dict[str, float] | None:
    """A crop box as {x, y, w, h} in 0..1, or None when there is nothing to crop.

    Accepts the shape we ask for and the model's native one: [ymin, xmin, ymax,
    xmax] on a 0..1000 scale.
    """
    try:
        if isinstance(raw, (list, tuple)) and len(raw) == 4:
            ymin, xmin, ymax, xmax = (float(value) for value in raw)
            x, y, w, h = xmin, ymin, xmax - xmin, ymax - ymin
        elif isinstance(raw, dict):
            x, y, w, h = (float(raw[key]) for key in ("x", "y", "w", "h"))
        else:
            return None
    except (KeyError, TypeError, ValueError):
        return None

    if max(x, y, w, h) > 1.5:
        x, y, w, h = (value / 1000 for value in (x, y, w, h))

    x = min(max(x, 0.0), 1.0)
    y = min(max(y, 0.0), 1.0)
    w = min(max(w, 0.0), 1.0 - x)
    h = min(max(h, 0.0), 1.0 - y)
    if w < 0.02 or h < 0.02:
        return None
    return {"x": x, "y": y, "w": w, "h": h}


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


# "II.", "II. 3.", "3." or "§ 3." in front of a title.
_TITLE_NUMBER = re.compile(
    r"^((?:§\s*\d+\.?|(?:[IVXLCІХ]+|\d+)\.)(?:\s*\d+\.)*)\s*(.*)$", re.DOTALL
)
# Cyrillic letters that scans and models use in place of Roman numerals.
_ROMAN_LOOKALIKES = str.maketrans({"І": "I", "Х": "X"})


def normalize_title(raw: str) -> str:
    """A unit title as it should read in a table of contents.

    One line, Roman numerals in Latin letters, and sentence capitalization when
    the book prints the title in capitals. Proper nouns inside a capitalized
    title come out lowercase; a reviewer restores them.
    """
    title = " ".join(raw.split())
    number, rest = "", title
    match = _TITLE_NUMBER.match(title)
    if match and match.group(2):
        number = match.group(1).translate(_ROMAN_LOOKALIKES)
        rest = match.group(2)

    letters = [char for char in rest if char.isalpha()]
    if len(letters) >= 4 and all(char.isupper() for char in letters):
        rest = rest.lower()
        rest = rest[:1].upper() + rest[1:]
    return f"{number} {rest}".strip()


def heading_level(title: str, given: Any = None) -> int:
    """1–6. An explicit level wins; otherwise the title's numbering decides."""
    if isinstance(given, int) and not isinstance(given, bool) and 1 <= given <= 6:
        return given
    if isinstance(given, str) and given.isdigit() and 1 <= int(given) <= 6:
        return int(given)
    match = _TITLE_NUMBER.match(title.strip())
    number = match.group(1) if match else ""
    if not number:
        return 2
    if number.lstrip().startswith("§"):
        return 2
    parts = [part for part in number.split(".") if part.strip()]
    return min(6, max(1, len(parts)))


# A Markdown heading that carries a chapter or section number: "## II. ...",
# "### II. 3. ..." or "## § 3. ...". The hashes are its level.
_NUMBERED_HEADING = re.compile(
    r"^(#{1,6})\s+\**((?:[IVXLCІХ]+\.(?:\s*\d+\.)?|§\s*\d+\.?)\s+\S.*?)\**\s*$"
)
# A line of a printed table of contents: a title, dot leaders, a page number.
_CONTENTS_LINE = re.compile(r"(?:\.{3,}|…)\s*\d+\s*$")


def split_numbered_headings(markdown: str) -> list[dict[str, Any]]:
    """Markdown with its numbered chapter and section headings lifted out as unit headers.

    The model is asked to do this itself and usually does; when it leaves such a
    title as a heading, the unit would otherwise be missing from the outline.
    """
    blocks: list[dict[str, Any]] = []
    kept: list[str] = []

    def flush() -> None:
        text = "\n".join(kept).strip()
        kept.clear()
        if text:
            blocks.append({"type": "markdown", "markdown": text})

    for line in markdown.split("\n"):
        heading = _NUMBERED_HEADING.match(line.strip())
        if heading and not _CONTENTS_LINE.search(line):
            flush()
            blocks.append(
                {
                    "type": "unit_header",
                    "title": normalize_title(heading.group(2)),
                    "level": len(heading.group(1)),
                }
            )
        else:
            kept.append(line)
    flush()
    return blocks


def _span(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    number = int(value) if isinstance(value, (int, float, str)) and str(value).isdigit() else None
    return number if number is not None and number > 1 else None


def _normalize_table(raw: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    rows: list[dict[str, Any]] = []
    for raw_row in raw.get("rows") or []:
        if not isinstance(raw_row, dict):
            continue
        cells: list[dict[str, Any]] = []
        for raw_cell in raw_row.get("cells") or []:
            if isinstance(raw_cell, str):
                cells.append({"text": raw_cell.strip()})
                continue
            if not isinstance(raw_cell, dict):
                continue
            cell: dict[str, Any] = {"text": _text(raw_cell.get("text"))}
            colspan = _span(raw_cell.get("colspan"))
            rowspan = _span(raw_cell.get("rowspan"))
            if colspan is not None:
                cell["colspan"] = colspan
            if rowspan is not None:
                cell["rowspan"] = rowspan
            cells.append(cell)
        if cells:
            rows.append({"header": raw_row.get("header") is True, "cells": cells})
    if not rows:
        return None, "dropped_block: table had no rows"
    return (
        {"type": "table", "caption": _text(raw.get("caption")) or None, "rows": rows},
        None,
    )


def _normalize_block(raw: Any) -> tuple[dict[str, Any] | None, str | None]:
    """One block in the shape we store, or (None, warning) when it cannot be kept."""
    if not isinstance(raw, dict):
        return None, "dropped_block: the model returned something that is not a block"

    block_type = raw.get("type")
    if block_type == "unit_header":
        title = normalize_title(_text(raw.get("title")))
        if not title:
            return None, None
        return (
            {"type": "unit_header", "title": title, "level": heading_level(title, raw.get("level"))},
            None,
        )

    if block_type == "image":
        box = _normalize_box(raw.get("bbox", raw.get("box_2d")))
        if box is None:
            return None, (
                "image_without_box: the model saw a figure but gave no usable "
                "position for it; check the page image"
            )
        return (
            {
                "type": "image",
                "bbox": box,
                "alt": _text(raw.get("alt")),
                "ai_description": _text(raw.get("ai_description")),
                "caption": _text(raw.get("caption")) or None,
            },
            None,
        )

    if block_type == "table":
        return _normalize_table(raw)

    # Anything else that carries text is kept as Markdown rather than lost.
    markdown = _text(raw.get("markdown")) or _text(raw.get("text"))
    if markdown:
        return {"type": "markdown", "markdown": markdown}, None
    if block_type == "markdown":
        return None, None
    return None, f"dropped_block: unknown block type {block_type!r}"


# Models sometimes escape characters JSON does not escape (\' or \°), which
# makes the whole answer unreadable. The backslash is dropped; valid escapes,
# including an escaped backslash, are matched as a pair and kept.
_INVALID_ESCAPE = re.compile(r"\\(.)", re.DOTALL)


def _drop_invalid_escape(match: re.Match[str]) -> str:
    return match.group(0) if match.group(1) in '"\\/bfnrtu' else match.group(1)


def _unit_header_as_markdown(block: dict[str, Any]) -> dict[str, Any]:
    """Demote a stray unit_header on a non-body page into a Markdown heading."""
    level = block.get("level", 2)
    hashes = "#" * min(6, max(1, int(level) if isinstance(level, int) else 2))
    return {"type": "markdown", "markdown": f"{hashes} {block.get('title', '')}".strip()}


def parse_page_response(
    content: str,
    *,
    page_role: str = "body",
) -> LlmPageResponse:
    """Turn the model's answer into a page, keeping every block that can be kept."""
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        try:
            payload = json.loads(_INVALID_ESCAPE.sub(_drop_invalid_escape, text))
        except json.JSONDecodeError as exc:
            raise UnusableResponse(f"model answer is not JSON: {exc}") from exc

    if isinstance(payload, list):
        payload = {"blocks": payload}
    if not isinstance(payload, dict) or not isinstance(payload.get("blocks"), list):
        raise UnusableResponse("model answer has no list of blocks")

    allow_headers = page_role == "body"
    blocks: list[dict[str, Any]] = []
    warnings = [item for item in payload.get("warnings") or [] if isinstance(item, str)]
    for raw in payload["blocks"]:
        block, warning = _normalize_block(raw)
        if block is not None and block["type"] == "markdown":
            if allow_headers:
                blocks.extend(split_numbered_headings(block["markdown"]))
            else:
                blocks.append(block)
        elif block is not None and block["type"] == "unit_header" and not allow_headers:
            blocks.append(_unit_header_as_markdown(block))
        elif block is not None:
            blocks.append(block)
        if warning and warning not in warnings:
            warnings.append(warning)

    printed = payload.get("printedPage")
    result: dict[str, Any] = {
        "printedPage": printed if isinstance(printed, (str, int)) else None,
        "continuesFromPrevious": payload.get("continuesFromPrevious") is True,
        "blocks": blocks,
        "warnings": warnings,
    }
    toc_entries = normalize_toc_entries(payload.get("tocEntries"))
    if toc_entries:
        result["tocEntries"] = toc_entries
    cover_meta = normalize_cover_meta(payload.get("coverMeta"))
    if cover_meta:
        result["coverMeta"] = cover_meta
    return LlmPageResponse.model_validate(result)


_RETRY_HINT = re.compile(r"retry(?:Delay)?\W{0,6}(?:in )?(\d+(?:\.\d+)?)\s*s", re.IGNORECASE)


def retry_delay(error: Exception, attempt: int) -> float:
    """Seconds to wait before asking again: what the service asks for, else a growing pause."""
    hint = _RETRY_HINT.search(str(error))
    if hint:
        return min(float(hint.group(1)) + 1.0, 120.0)
    return min(5.0 * 2 ** (attempt - 1), 60.0) + random.uniform(0, 2)


def _complete(
    *,
    page_number: int,
    language: str,
    image_url: str,
    model: str,
    prompt: str,
) -> str:
    import litellm

    reasoning: dict[str, Any] = {}
    if settings.llm_reasoning_effort:
        reasoning["reasoning_effort"] = settings.llm_reasoning_effort

    response = litellm.completion(
        **reasoning,
        model=model,
        # Transcription wants no creativity. Newer models fix their own sampling
        # and reject the setting, so it is dropped where it is not supported.
        temperature=0,
        drop_params=True,
        api_key=provider_api_key(model),
        timeout=settings.llm_timeout_sec,
        # Retries are handled here, per page, with the service's own retry hint.
        num_retries=0,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"{prompt}\npdfPagePosition={page_number}\nlanguage={language}",
                    },
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    usage = getattr(response, "usage", None)
    logger.info(
        "page %s: model answered (%s tokens in, %s out)",
        page_number,
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
    )
    content = response["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise UnusableResponse("model answer is empty")
    return content


def extract_page(
    *,
    page_number: int,
    language: str,
    image: Image.Image,
    model: str | None = None,
    page_role: str = "body",
    book_title: str = "Textbook",
    grade: int | None = None,
    toc_hint: str = "",
) -> LlmPageResponse:
    model = model or settings.llm_model
    if uses_mock(model):
        return mock_extract(page_number=page_number, language=language, image=image)

    import litellm

    # Worth another try: the service is busy or briefly down. Anything else
    # (bad key, rejected request) fails the same way every time.
    transient = (
        litellm.RateLimitError,
        litellm.Timeout,
        litellm.APIConnectionError,
        litellm.InternalServerError,
        litellm.ServiceUnavailableError,
    )
    image_url = _image_data_url(image)
    prompt = prompt_for_role(
        page_role,
        title=book_title or "Textbook",
        language=language,
        grade=grade,
        toc_hint=toc_hint,
    )

    for attempt in range(1, settings.llm_max_attempts + 1):
        try:
            content = _complete(
                page_number=page_number,
                language=language,
                image_url=image_url,
                model=model,
                prompt=prompt,
            )
            return parse_page_response(content, page_role=page_role)
        except UnusableResponse as exc:
            error, wait = exc, 0.0
        except transient as exc:
            # A spent daily quota does not come back in a minute.
            if "PerDay" in str(exc):
                raise RuntimeError(
                    "The model's daily quota is used up; retry the failed pages tomorrow "
                    "or use a key with billing enabled"
                ) from exc
            error, wait = exc, retry_delay(exc, attempt)

        if attempt == settings.llm_max_attempts:
            # The message is stored on the page and shown in the admin: never the key.
            detail = _redact(str(error))[:300]
            raise RuntimeError(
                f"extraction failed after {attempt} attempts: "
                f"{type(error).__name__}: {detail}"
            ) from None
        logger.warning(
            "page %s: attempt %s failed (%s: %s); retrying in %.0fs",
            page_number,
            attempt,
            type(error).__name__,
            " ".join(_redact(str(error)).split())[:160],
            wait,
        )
        time.sleep(wait)

    raise AssertionError("unreachable")


def kyrgyz_warning(language: str, text: str) -> str | None:
    if language != "ky":
        return None
    compact = "".join(text.split())
    if len(compact) < 80:
        return None
    if any(ch in text for ch in "ӨөҮүҢң"):
        return None
    return "ky_page_missing_kyrgyz_letters: long transcription has no Ө/Ү/Ң characters"


def collect_text(blocks: list[Any]) -> str:
    parts: list[str] = []
    for block in blocks:
        data = block.model_dump() if hasattr(block, "model_dump") else block
        block_type = data.get("type")
        if block_type == "markdown":
            parts.append(data.get("markdown", ""))
        elif block_type == "unit_header":
            parts.append(data.get("title", ""))
        elif block_type == "table":
            cells = [
                cell.get("text", "")
                for row in data.get("rows") or []
                if isinstance(row, dict)
                for cell in row.get("cells") or []
                if isinstance(cell, dict)
            ]
            parts.append(" ".join([data.get("caption") or "", *cells]))
        elif block_type == "image":
            parts.append(
                f"{data.get('alt', '')} {data.get('ai_description', '')} {data.get('caption') or ''}"
            )
    return "\n".join(parts)
