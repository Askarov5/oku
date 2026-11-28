from __future__ import annotations

import asyncio
import logging
from typing import Any

from app import db as dbmod
from app import lesson_db
from app.config import settings
from app.lesson_llm import (
    generate_validated,
    mock_materials,
    mock_plan,
    resolve_lesson_model,
)
from app.lesson_models import LessonMaterialsPayload, LessonPlanPayload
from app.lesson_prompts import materials_prompt, plan_prompt
from app.quiz_generate import generate_homework_set, generate_live_set

logger = logging.getLogger("oku.worker.lesson")


class LessonPipeline:
    async def poll_forever(self) -> None:
        while True:
            try:
                processed = await asyncio.to_thread(self.process_one_job)
                if not processed:
                    await asyncio.sleep(settings.worker_poll_interval_sec)
            except Exception:
                logger.exception("lesson worker loop failure")
                await asyncio.sleep(settings.worker_poll_interval_sec)

    def process_one_job(self) -> bool:
        with dbmod.connect() as conn:
            reclaimed = lesson_db.reclaim_stale_lesson_jobs(conn)
            if reclaimed:
                logger.warning("requeued %s stale lesson job(s)", reclaimed)
            job = lesson_db.claim_lesson_job(conn)
            if not job:
                return False
            lesson = lesson_db.get_lesson(conn, job["lesson_id"])
            saved_model = resolve_lesson_model(conn)

        # LLM work runs without holding the claim connection open.
        try:
            if job["kind"] == "plan":
                self._run_plan(job=job, lesson=lesson, saved_model=saved_model)
            else:
                self._run_materials(job=job, lesson=lesson, saved_model=saved_model)
        except Exception as exc:
            logger.exception("lesson job %s failed", job["id"])
            detail = str(exc)[:500]
            with dbmod.connect() as conn:
                lesson_db.finish_lesson_job(
                    conn,
                    job_id=job["id"],
                    status="failed",
                    error=detail,
                )
                lesson_db.mark_lesson_failed(conn, lesson_id=job["lesson_id"])
        return True

    def _run_plan(
        self,
        *,
        job: dict[str, Any],
        lesson: dict[str, Any],
        saved_model: Any,
    ) -> None:
        grounding = lesson.get("grounding") or {}
        payload, model = generate_validated(
            prompt=plan_prompt(grounding),
            model_cls=LessonPlanPayload,
            saved_model=saved_model,
            mock_factory=lambda: mock_plan(grounding),
        )
        with dbmod.connect() as conn:
            lesson_db.write_plan(
                conn,
                lesson_id=lesson["id"],
                title=payload.title,
                plan_blocks=[block.model_dump() for block in payload.planBlocks],
            )
            lesson_db.finish_lesson_job(
                conn,
                job_id=job["id"],
                status="done",
                model=model,
            )

    def _run_materials(
        self,
        *,
        job: dict[str, Any],
        lesson: dict[str, Any],
        saved_model: Any,
    ) -> None:
        from app.lesson_prompts import (
            resolve_homework_count,
            resolve_quiz_count,
            resolve_slide_count,
        )

        grounding = lesson.get("grounding") or {}
        plan_blocks = lesson.get("plan_blocks") or []
        deliverables = lesson.get("deliverables") or {
            "slides": True,
            "kahootTest": True,
            "homework": True,
        }
        share_code = lesson["share_code"]
        slide_count = resolve_slide_count(deliverables)
        quiz_count = resolve_quiz_count(deliverables)
        homework_count = resolve_homework_count(deliverables)

        def factory() -> LessonMaterialsPayload:
            return mock_materials(grounding, plan_blocks, deliverables, share_code)

        payload, model = generate_validated(
            prompt=materials_prompt(grounding, plan_blocks, deliverables, share_code),
            model_cls=LessonMaterialsPayload,
            saved_model=saved_model,
            mock_factory=factory,
        )
        raw_slides = [slide.model_dump() for slide in payload.slides]
        if not deliverables.get("slides"):
            slides: list[dict[str, Any]] = []
        else:
            teaching = [
                slide
                for slide in raw_slides
                if slide.get("kind") != "quiz_launch"
            ][:slide_count]
            launch = next(
                (
                    slide
                    for slide in raw_slides
                    if slide.get("kind") == "quiz_launch"
                ),
                None,
            )
            if deliverables.get("kahootTest"):
                if launch is None:
                    launch = {
                        "id": "slide-quiz",
                        "kind": "quiz_launch",
                        "lessonNumber": 1,
                        "title": "Quiz check",
                        "bullets": [f"Open /play/{share_code}"],
                        "formulaOrCallout": None,
                        "pageRef": None,
                        "imageUrl": None,
                        "imageCaption": None,
                        "speakerNotes": "Students join on their own devices.",
                    }
                slides = [*teaching, launch]
            else:
                slides = teaching

        with dbmod.connect() as conn:
            lesson_db.touch_lesson_job(conn, job_id=job["id"])

        live_questions: list[dict[str, Any]] = []
        homework_questions: list[dict[str, Any]] = []
        if deliverables.get("kahootTest"):
            live_questions = [
                item.to_storage()
                for item in generate_live_set(
                    grounding,
                    count=quiz_count,
                    saved_model=saved_model,
                    plan_blocks=plan_blocks,
                )
            ]
            with dbmod.connect() as conn:
                lesson_db.touch_lesson_job(conn, job_id=job["id"])
        if deliverables.get("homework"):
            homework_questions = [
                item.to_storage()
                for item in generate_homework_set(
                    grounding,
                    count=homework_count,
                    saved_model=saved_model,
                    plan_blocks=plan_blocks,
                )
            ]
            with dbmod.connect() as conn:
                lesson_db.touch_lesson_job(conn, job_id=job["id"])

        with dbmod.connect() as conn:
            lesson_db.write_materials(
                conn,
                lesson_id=lesson["id"],
                slides=slides,
                live_questions=live_questions,
                homework_questions=homework_questions,
            )
            lesson_db.finish_lesson_job(
                conn,
                job_id=job["id"],
                status="done",
                model=model,
            )
