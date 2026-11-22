from __future__ import annotations

import io

import pymupdf
from PIL import Image


DPI = 200


def rasterize_page(pdf_bytes: bytes, page_number: int) -> Image.Image:
    """Rasterize 1-based page_number at 200 DPI."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_number - 1)
        zoom = DPI / 72.0
        matrix = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        return image
    finally:
        doc.close()


def image_to_webp_bytes(image: Image.Image, quality: int = 80) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=quality, method=6)
    return buffer.getvalue()


def crop_normalized(image: Image.Image, bbox: dict[str, float]) -> Image.Image:
    width, height = image.size
    left = max(0, int(bbox["x"] * width))
    top = max(0, int(bbox["y"] * height))
    right = min(width, int((bbox["x"] + bbox["w"]) * width))
    bottom = min(height, int((bbox["y"] + bbox["h"]) * height))
    if right <= left or bottom <= top:
        raise ValueError("invalid crop bbox")
    return image.crop((left, top, right, bottom))
