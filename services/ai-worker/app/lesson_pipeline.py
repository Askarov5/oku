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
            job = lesson_db.claim_lesson_job(conn)
            if not job:
                return False

            try:
                lesson = lesson_db.get_lesson(conn, job["lesson_id"])
                saved_model = resolve_lesson_model(conn)
                if job["kind"] == "plan":
                    self._run_plan(conn, job=job, lesson=lesson, saved_model=saved_model)
                else:
                    self._run_materials(conn, job=job, lesson=lesson, saved_model=saved_model)
            except Exception as exc:
                logger.exception("lesson job %s failed", job["id"])
                detail = str(exc)[:500]
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
        conn: Any,
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
        conn: Any,
        *,
        job: dict[str, Any],
        lesson: dict[str, Any],
        saved_model: Any,
    ) -> None:
        grounding = lesson.get("grounding") or {}
        plan_blocks = lesson.get("plan_blocks") or []
        deliverables = lesson.get("deliverables") or {
            "slides": True,
            "kahootTest": True,
            "homework": True,
        }
        share_code = lesson["share_code"]

        def factory() -> LessonMaterialsPayload:
            return mock_materials(grounding, plan_blocks, deliverables, share_code)

        payload, model = generate_validated(
            prompt=materials_prompt(grounding, plan_blocks, deliverables, share_code),
            model_cls=LessonMaterialsPayload,
            saved_model=saved_model,
            mock_factory=factory,
        )
        slides = [slide.model_dump() for slide in payload.slides]
        questions = [question.model_dump() for question in payload.questions]
        homework = [item.model_dump() for item in payload.homework]
        if not deliverables.get("slides"):
            slides = []
        if not deliverables.get("kahootTest"):
            questions = []
            slides = [slide for slide in slides if slide.get("kind") != "quiz_launch"]
        if not deliverables.get("homework"):
            homework = []

        lesson_db.write_materials(
            conn,
            lesson_id=lesson["id"],
            slides=slides,
            homework=homework,
            questions=questions,
        )
        lesson_db.finish_lesson_job(
            conn,
            job_id=job["id"],
            status="done",
            model=model,
        )
