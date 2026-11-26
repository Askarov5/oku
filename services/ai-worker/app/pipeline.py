from __future__ import annotations

import asyncio
import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app import db as dbmod
from app.config import settings
from app.contents import collect_toc_from_job_pages, load_contents_outline, prompt_hint
from app.layout import DoclingLayoutDetector, NullLayoutDetector, snap_to_layout
from app.llm import (
    EXTRACTION_MODEL_SETTING,
    collect_text,
    extract_page,
    kyrgyz_warning,
    model_name,
    resolve_model,
)
from app.models import (
    BBox,
    ImageBlock,
    LlmBlock,
    MarkdownBlock,
    PageBlock,
    PageExtractedJson,
)
from app.raster import crop_normalized, image_to_webp_bytes, rasterize_page
from app.storage import download_bytes, upload_bytes

logger = logging.getLogger("oku.worker")

UNPLACED_FIGURE_WARNING = (
    "unplaced_figure: a figure was detected on the page but not placed in the "
    "text; it was added at the end, move it to where it belongs"
)


def merge_adjacent_markdown(blocks: list[PageBlock]) -> list[PageBlock]:
    """Neighbouring Markdown blocks are one block; only components separate text."""
    merged: list[PageBlock] = []
    for block in blocks:
        previous = merged[-1] if merged else None
        if isinstance(block, MarkdownBlock) and isinstance(previous, MarkdownBlock):
            parts = [previous.markdown.rstrip(), block.markdown.lstrip()]
            merged[-1] = previous.model_copy(
                update={"markdown": "\n\n".join(part for part in parts if part)}
            )
            continue
        merged.append(block)
    return merged


def assemble_blocks(
    llm_blocks: list[LlmBlock],
    layout_boxes: list[dict[str, float]],
    *,
    page_number: int,
    store_figure: Callable[[str, dict[str, float]], str],
) -> tuple[list[PageBlock], list[str]]:
    """Turn the model's reading-order blocks into stored page blocks.

    Each image stays where the model placed it between the text; its box is
    widened to the matching layout box before cropping. A layout figure the
    model never placed goes to the end of the page with a warning, so the
    reviewer can move it.
    """
    blocks: list[PageBlock] = []
    warnings: list[str] = []
    used_layout: set[int] = set()

    for block in llm_blocks:
        if block.type != "image":
            blocks.append(block)
            continue
        box, layout_index = snap_to_layout(block.bbox.model_dump(), layout_boxes)
        if layout_index is not None:
            used_layout.add(layout_index)
        blocks.append(
            ImageBlock(
                id=block.id,
                type="image",
                url=store_figure(block.id, box),
                alt=block.alt,
                ai_description=block.ai_description,
                caption=block.caption,
                bbox=BBox.model_validate(box),
            )
        )

    for index, box in enumerate(layout_boxes):
        if index in used_layout:
            continue
        block_id = f"img-{page_number}-{index + 1}"
        blocks.append(
            ImageBlock(
                id=block_id,
                type="image",
                url=store_figure(block_id, box),
                alt="",
                ai_description="",
                bbox=BBox.model_validate(box),
            )
        )
        if UNPLACED_FIGURE_WARNING not in warnings:
            warnings.append(UNPLACED_FIGURE_WARNING)

    return merge_adjacent_markdown(blocks), warnings


class IngestionPipeline:
    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(
            max_workers=max(1, settings.ingest_page_concurrency)
        )
        # MuPDF is not safe to call from several threads at once.
        self._raster_lock = threading.Lock()
        self._layout = DoclingLayoutDetector()
        self._fallback_layout = NullLayoutDetector()

    async def poll_forever(self) -> None:
        while True:
            try:
                processed = await asyncio.to_thread(self.process_one_job)
                if not processed:
                    await asyncio.sleep(settings.worker_poll_interval_sec)
            except Exception:
                logger.exception("worker loop failure")
                await asyncio.sleep(settings.worker_poll_interval_sec)

    def process_one_job(self) -> bool:
        with dbmod.connect() as conn:
            job = dbmod.claim_job(conn)
            if not job:
                return False

            try:
                book = dbmod.get_book(conn, job["book_id"])
                pdf_bytes = download_bytes(book["source_pdf_url"])
            except Exception as exc:
                # Nothing can be read. Fail the waiting pages, or the job stays
                # "running" and the page screen waits forever.
                logger.exception("job %s: could not open the book", job["id"])
                detail = str(exc)[:300]
                for page_number in range(job["page_start"], job["page_end"] + 1):
                    page = dbmod.get_page(conn, job["book_id"], page_number)
                    if page and page["status"] == "pending":
                        dbmod.mark_page(
                            conn,
                            book_id=job["book_id"],
                            page_number=page_number,
                            status="failed",
                            error_message=detail,
                            stage="failed",
                        )
                dbmod.finish_job(
                    conn,
                    job_id=job["id"],
                    failed_pages=job["total_pages"],
                    error=detail,
                )
                return True
            # Read once per job: every page of a job is extracted by the same model.
            # A per-job model (retry dialog) overrides the global extraction setting.
            model = resolve_model(
                job.get("model")
                or dbmod.get_setting(conn, EXTRACTION_MODEL_SETTING)
            )
            page_numbers = dbmod.job_page_numbers(job)
            # TOC hint for body pages: prefer the saved outline, else digitized TOC.
            all_pages = dbmod.list_pages(conn, book["id"])
            outline = load_contents_outline(book, all_pages) or []
            toc_hint = prompt_hint(outline)
            logger.info(
                "job %s: %s page(s) with %s",
                job["id"],
                len(page_numbers),
                model_name(model),
            )

            def run_page(page_number: int) -> bool:
                """Extract one page on its own connection. Returns True when it failed."""
                try:
                    return extract(page_number)
                except Exception:
                    # Even the failure could not be recorded (database trouble).
                    # Count it so the job still finishes; the page stays pending.
                    logger.exception("page %s: could not record the result", page_number)
                    return True

            def extract(page_number: int) -> bool:
                with dbmod.connect() as page_conn:
                    page = dbmod.get_page(page_conn, book["id"], page_number)
                    if not page:
                        dbmod.bump_job_progress(
                            page_conn, job_id=job["id"], failed_delta=1
                        )
                        return True
                    # Only pages waiting for extraction are touched. Extracted and
                    # reviewed pages keep their content until someone asks for a retry.
                    if page["status"] != "pending":
                        dbmod.bump_job_progress(
                            page_conn, job_id=job["id"], completed_delta=1
                        )
                        return False

                    try:
                        self.process_page(
                            conn=page_conn,
                            book=book,
                            pdf_bytes=pdf_bytes,
                            page_number=page_number,
                            model=model,
                            page_role=page.get("page_role") or "body",
                            toc_hint=toc_hint,
                            instruction=str(job.get("instruction") or ""),
                        )
                        dbmod.bump_job_progress(
                            page_conn, job_id=job["id"], completed_delta=1
                        )
                        return False
                    except Exception as exc:
                        logger.error("page %s failed: %s", page_number, exc)
                        page_conn.rollback()
                        dbmod.mark_page(
                            page_conn,
                            book_id=book["id"],
                            page_number=page_number,
                            status="failed",
                            error_message=str(exc),
                            stage="failed",
                        )
                        dbmod.bump_job_progress(
                            page_conn, job_id=job["id"], failed_delta=1
                        )
                        return True

            failed = sum(self._executor.map(run_page, page_numbers))
            # Auto-seed TOC from extracted table_of_contents pages when unset.
            stored_outline = book.get("contents_outline")
            has_saved_outline = (
                isinstance(stored_outline, list) and len(stored_outline) > 0
            )
            if not has_saved_outline:
                refreshed = dbmod.list_pages(conn, book["id"])
                seeded = collect_toc_from_job_pages(refreshed)
                if seeded:
                    dbmod.save_contents_outline(conn, book["id"], seeded)
            dbmod.finish_job(conn, job_id=job["id"], failed_pages=failed)
            return True

    def process_page(
        self,
        *,
        conn,
        book: dict[str, Any],
        pdf_bytes: bytes,
        page_number: int,
        model: str | None = None,
        page_role: str = "body",
        toc_hint: str = "",
        instruction: str = "",
    ) -> None:
        dbmod.mark_page(
            conn,
            book_id=book["id"],
            page_number=page_number,
            status="pending",
            stage="rasterizing",
        )
        with self._raster_lock:
            image = rasterize_page(pdf_bytes, page_number)
        page_key = (
            f"books/kg/9/political_geography/{book['id']}/pages/{page_number}/page.webp"
        )
        page_url = upload_bytes(page_key, image_to_webp_bytes(image), "image/webp")

        dbmod.mark_page(
            conn,
            book_id=book["id"],
            page_number=page_number,
            status="pending",
            raw_image_url=page_url,
            stage="extracting",
        )

        grade = book.get("grade")
        grade_n = int(grade) if isinstance(grade, int) else None
        llm = extract_page(
            page_number=page_number,
            language=book["language"],
            image=image,
            model=model,
            page_role=page_role,
            book_title=str(book.get("title") or "Textbook"),
            grade=grade_n,
            toc_hint=toc_hint if page_role == "body" else "",
            instruction=instruction,
        )

        layout_boxes = []
        try:
            layout_boxes = self._layout.detect(image)
        except Exception:
            layout_boxes = self._fallback_layout.detect(image)

        def store_figure(block_id: str, box: dict[str, float]) -> str:
            crop = crop_normalized(image, box)
            figure_key = (
                f"books/kg/9/political_geography/{book['id']}/figures/{block_id}.webp"
            )
            return upload_bytes(figure_key, image_to_webp_bytes(crop), "image/webp")

        blocks, figure_warnings = assemble_blocks(
            list(llm.blocks),
            layout_boxes,
            page_number=page_number,
            store_figure=store_figure,
        )

        warnings = [*llm.warnings]
        for warning in [
            *figure_warnings,
            kyrgyz_warning(book["language"], collect_text(blocks)),
        ]:
            if warning and warning not in warnings:
                warnings.append(warning)

        extracted = PageExtractedJson(
            pageNumber=page_number,
            printedPage=llm.printedPage,
            continuesFromPrevious=llm.continuesFromPrevious,
            blocks=blocks,
            warnings=warnings,
            model=model_name(model),
            extractedAt=dbmod.utc_now_iso(),
            tocEntries=llm.tocEntries,
            coverMeta=llm.coverMeta,
        )

        dbmod.mark_page(
            conn,
            book_id=book["id"],
            page_number=page_number,
            status="extracted",
            raw_image_url=page_url,
            # Keep nulls: the shared schema requires printedPage to be present.
            extracted_json=extracted.model_dump(mode="json", exclude_none=True),
            error_message=None,
            stage="extracted",
        )
        dbmod.set_book_review(conn, book["id"])

