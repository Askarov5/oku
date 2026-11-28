from __future__ import annotations

import traceback

from app import db as dbmod
from app import lesson_db
from app.lesson_llm import generate_validated, mock_materials, resolve_lesson_model
from app.lesson_models import LessonMaterialsPayload
from app.lesson_prompts import (
    materials_prompt,
    resolve_homework_count,
    resolve_quiz_count,
    resolve_slide_count,
)
from app.quiz_generate import generate_homework_set, generate_live_set

LESSON_ID = "98fbb7c4-9908-497e-8585-8cf4baf2fe66"


def main() -> None:
    with dbmod.connect() as conn:
        lesson = lesson_db.get_lesson(conn, LESSON_ID)
        grounding = lesson.get("grounding") or {}
        plan_blocks = lesson.get("plan_blocks") or []
        deliverables = lesson.get("deliverables") or {}
        share_code = lesson["share_code"]
        saved = resolve_lesson_model(conn)
        print("saved model", saved)

    slide_count = resolve_slide_count(deliverables)
    quiz_count = resolve_quiz_count(deliverables)
    homework_count = resolve_homework_count(deliverables)

    print("slides...")
    payload, model = generate_validated(
        prompt=materials_prompt(grounding, plan_blocks, deliverables, share_code),
        model_cls=LessonMaterialsPayload,
        saved_model=saved,
        mock_factory=lambda: mock_materials(
            grounding, plan_blocks, deliverables, share_code
        ),
    )
    teaching = [s for s in payload.slides if s.kind != "quiz_launch"][:slide_count]
    launch = next((s for s in payload.slides if s.kind == "quiz_launch"), None)
    slides = [*teaching, *([launch] if deliverables.get("kahootTest") and launch else [])]
    print("slides", len(slides), "model", model)

    print("live...")
    live = [
        i.to_storage()
        for i in generate_live_set(
            grounding,
            count=quiz_count,
            saved_model=saved,
            plan_blocks=plan_blocks,
        )
    ]
    print("live", len(live))

    print("homework...")
    hw = [
        i.to_storage()
        for i in generate_homework_set(
            grounding,
            count=homework_count,
            saved_model=saved,
            plan_blocks=plan_blocks,
        )
    ]
    print("homework", len(hw), [h["kind"] for h in hw])

    with dbmod.connect() as conn:
        lesson_db.write_materials(
            conn,
            lesson_id=LESSON_ID,
            slides=[s.model_dump() for s in slides],
            live_questions=live,
            homework_questions=hw,
        )
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE lesson_jobs
                SET status = 'done',
                    finished_at = NOW(),
                    updated_at = NOW(),
                    model = COALESCE(%s, model)
                WHERE lesson_id = %s AND status = 'running'
                """,
                (model, LESSON_ID),
            )
        conn.commit()
        print("written and job finished")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
