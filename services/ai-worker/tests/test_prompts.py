from __future__ import annotations

from app.prompts import prompt_for_role


def test_body_prompt_requires_table_component_when_markdown_cannot() -> None:
    prompt = prompt_for_role("body", title="География", language="ky", grade=9)
    assert "decide for every printed table" in prompt
    assert 'emit a {"type": "table", ...} component' in prompt
    assert "Do NOT force a complex" in prompt
    assert '"idInBook"' in prompt
    assert "printed table number/label" in prompt


def test_prompt_appends_a_reviewer_note() -> None:
    base = prompt_for_role("body", title="География", language="ky", grade=9)
    with_note = prompt_for_role(
        "body",
        title="География",
        language="ky",
        grade=9,
        instruction="The map in the corner was skipped.",
    )
    assert with_note.startswith(base)
    assert "Reviewer note for this page only" in with_note
    assert "The map in the corner was skipped." in with_note


def test_empty_instruction_leaves_the_prompt_unchanged() -> None:
    base = prompt_for_role("cover", title="География", language="ky", grade=9)
    assert (
        prompt_for_role(
            "cover",
            title="География",
            language="ky",
            grade=9,
            instruction="   ",
        )
        == base
    )
