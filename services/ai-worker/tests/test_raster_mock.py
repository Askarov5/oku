from __future__ import annotations

from pathlib import Path

import pymupdf
from PIL import Image

from app.llm import mock_extract
from app.storage import local_root
from app.models import MarkdownBlock
from app.pipeline import UNPLACED_FIGURE_WARNING, assemble_blocks
from app.raster import crop_normalized, image_to_webp_bytes, rasterize_page


def _make_pdf_bytes() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=400, height=600)
    page.insert_text((72, 72), "Политическая география")
    page.insert_text((72, 120), "Кыргызстан Ө ү Ң")
    page.draw_rect(
        pymupdf.Rect(80, 180, 320, 360),
        color=(0.1, 0.2, 0.4),
        fill=(0.1, 0.2, 0.4),
    )
    page2 = doc.new_page(width=400, height=600)
    page2.insert_text((72, 72), "Страница 2")
    data = doc.tobytes()
    doc.close()
    return data


def test_rasterize_and_mock_extract_roundtrip() -> None:
    pdf = _make_pdf_bytes()
    image = rasterize_page(pdf, 1)
    assert isinstance(image, Image.Image)
    assert image.size[0] > 0

    webp = image_to_webp_bytes(image)
    assert webp[:4] == b"RIFF"

    response = mock_extract(page_number=1, language="ky", image=image)
    images = [block for block in response.blocks if block.type == "image"]
    assert images
    crop = crop_normalized(image, images[0].bbox.model_dump())
    assert crop.size[0] > 0
    assert image_to_webp_bytes(crop)


def test_mock_page_is_markdown_with_the_image_in_reading_order() -> None:
    image = Image.new("RGB", (100, 100))
    response = mock_extract(page_number=1, language="ky", image=image)
    assert response.printedPage == "1"
    assert [block.type for block in response.blocks] == [
        "unit_header",
        "markdown",
        "image",
        "markdown",
    ]

    stored: list[str] = []

    def store_figure(block_id: str, box: dict[str, float]) -> str:
        stored.append(block_id)
        return f"/figures/{block_id}.webp"

    blocks, warnings = assemble_blocks(
        list(response.blocks), [], page_number=1, store_figure=store_figure
    )
    assert warnings == []
    # The image keeps its place between the two runs of text.
    assert [block.type for block in blocks] == [
        "unit_header",
        "markdown",
        "image",
        "markdown",
    ]
    assert blocks[2].url == f"/figures/{stored[0]}.webp"


def test_mock_second_page_continues_the_paragraph() -> None:
    image = Image.new("RGB", (100, 100))
    response = mock_extract(page_number=2, language="ky", image=image)
    assert response.continuesFromPrevious is True
    assert response.blocks[0].type == "markdown"


def test_assemble_merges_text_and_appends_unplaced_figures() -> None:
    llm_blocks = [
        MarkdownBlock(id="a", type="markdown", markdown="# Heading"),
        MarkdownBlock(id="b", type="markdown", markdown="Paragraph."),
    ]
    layout = [{"x": 0.1, "y": 0.5, "w": 0.3, "h": 0.3}]

    blocks, warnings = assemble_blocks(
        llm_blocks,
        layout,
        page_number=7,
        store_figure=lambda block_id, box: f"/figures/{block_id}.webp",
    )

    assert [block.type for block in blocks] == ["markdown", "image"]
    assert blocks[0].markdown == "# Heading\n\nParagraph."
    assert blocks[1].id == "img-7-1"
    assert warnings == [UNPLACED_FIGURE_WARNING]


def test_a_relative_storage_dir_is_read_from_the_repo_root(monkeypatch) -> None:
    monkeypatch.setenv("LOCAL_STORAGE_DIR", ".r2-local")
    # This file lives in services/ai-worker/tests; the repo root is three up.
    repo_root = Path(__file__).resolve().parents[3]
    assert local_root() == (repo_root / ".r2-local").resolve()
