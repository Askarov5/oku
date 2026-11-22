from __future__ import annotations

from typing import Protocol

from PIL import Image


class LayoutDetector(Protocol):
    def detect(self, image: Image.Image) -> list[dict[str, float]]:
        """Return normalized figure boxes {x,y,w,h} in 0..1."""


class NullLayoutDetector:
    def detect(self, image: Image.Image) -> list[dict[str, float]]:
        return []


class DoclingLayoutDetector:
    """Best-effort Docling pass. Falls back to empty if Docling is unavailable."""

    def detect(self, image: Image.Image) -> list[dict[str, float]]:
        try:
            from docling.document_converter import DocumentConverter  # type: ignore
        except Exception:
            return []

        # Docling is optional for Phase 1 local/dev; keep interface ready.
        # Full PDF-path conversion is heavier than page-image heuristics, so
        # when the package is present but image APIs differ we still return [].
        _ = DocumentConverter
        _ = image
        return []


def _iou(a: dict[str, float], b: dict[str, float]) -> float:
    ax2, ay2 = a["x"] + a["w"], a["y"] + a["h"]
    bx2, by2 = b["x"] + b["w"], b["y"] + b["h"]
    ix1, iy1 = max(a["x"], b["x"]), max(a["y"], b["y"])
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    union = a["w"] * a["h"] + b["w"] * b["h"] - inter
    return inter / union if union else 0.0


def snap_to_layout(
    box: dict[str, float],
    layout_boxes: list[dict[str, float]],
    *,
    min_iou: float = 0.3,
) -> tuple[dict[str, float], int | None]:
    """Widen a model-proposed figure box to the layout box it overlaps most.

    The model knows where a figure sits in the reading order; the layout pass
    knows its edges. Returns the crop box (the union of the two, so nothing is
    cut off) and the index of the matched layout box, or the box unchanged and
    None when no layout box overlaps enough.
    """
    best_index: int | None = None
    best_iou = min_iou
    for index, candidate in enumerate(layout_boxes):
        overlap = _iou(box, candidate)
        if overlap >= best_iou:
            best_index, best_iou = index, overlap

    if best_index is None:
        return dict(box), None

    match = layout_boxes[best_index]
    x1 = min(box["x"], match["x"])
    y1 = min(box["y"], match["y"])
    x2 = max(box["x"] + box["w"], match["x"] + match["w"])
    y2 = max(box["y"] + box["h"], match["y"] + match["h"])
    return {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}, best_index
