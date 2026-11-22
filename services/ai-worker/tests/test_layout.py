from app.layout import snap_to_layout


def test_snap_widens_to_the_overlapping_layout_box() -> None:
    proposed = {"x": 0.2, "y": 0.2, "w": 0.4, "h": 0.4}
    layout = [
        {"x": 0.8, "y": 0.8, "w": 0.1, "h": 0.1},
        {"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.4},
    ]
    box, index = snap_to_layout(proposed, layout)
    assert index == 1
    assert box["x"] <= 0.1
    assert box["w"] >= 0.5


def test_snap_keeps_the_box_when_nothing_overlaps() -> None:
    proposed = {"x": 0.2, "y": 0.2, "w": 0.2, "h": 0.2}
    box, index = snap_to_layout(proposed, [{"x": 0.7, "y": 0.7, "w": 0.2, "h": 0.2}])
    assert index is None
    assert box == proposed
