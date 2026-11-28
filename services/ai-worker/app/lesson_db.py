from __future__ import annotations

from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb


def reclaim_stale_lesson_jobs(
    conn: psycopg.Connection,
    *,
    stale_after_sec: int = 600,
) -> int:
    """Re-queue materials/plan jobs left in `running` after a worker crash."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lesson_jobs
            SET status = 'queued',
                error = COALESCE(error, 'requeued after stale running state'),
                started_at = NULL,
                updated_at = NOW()
            WHERE status = 'running'
              AND COALESCE(updated_at, started_at, created_at)
                  < NOW() - (%s * INTERVAL '1 second')
            RETURNING id
            """,
            (stale_after_sec,),
        )
        rows = cur.fetchall()
    conn.commit()
    return len(rows)


def claim_lesson_job(conn: psycopg.Connection) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM lesson_jobs
            WHERE status = 'queued'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return None

        cur.execute(
            """
            UPDATE lesson_jobs
            SET status = 'running',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (row["id"],),
        )
        job = cur.fetchone()
    conn.commit()
    return job


def get_lesson(conn: psycopg.Connection, lesson_id: UUID | str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM lessons WHERE id = %s", (lesson_id,))
        lesson = cur.fetchone()
        if not lesson:
            raise ValueError(f"lesson not found: {lesson_id}")
        return lesson


def touch_lesson_job(conn: psycopg.Connection, *, job_id: UUID | str) -> None:
    """Bump updated_at so long LLM runs are not mistaken for crashed workers."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lesson_jobs
            SET updated_at = NOW()
            WHERE id = %s AND status = 'running'
            """,
            (job_id,),
        )
    conn.commit()


def finish_lesson_job(
    conn: psycopg.Connection,
    *,
    job_id: UUID | str,
    status: str,
    error: str | None = None,
    model: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lesson_jobs
            SET status = %s,
                error = %s,
                model = COALESCE(%s, model),
                finished_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (status, error, model, job_id),
        )
    conn.commit()


def write_plan(
    conn: psycopg.Connection,
    *,
    lesson_id: UUID | str,
    title: str,
    plan_blocks: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lessons
            SET title = %s,
                plan_blocks = %s,
                stage = 'review_plan',
                updated_at = NOW()
            WHERE id = %s
            """,
            (title, Jsonb(plan_blocks), lesson_id),
        )
    conn.commit()


def write_materials(
    conn: psycopg.Connection,
    *,
    lesson_id: UUID | str,
    slides: list[dict[str, Any]],
    live_questions: list[dict[str, Any]],
    homework_questions: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lessons
            SET slides = %s,
                homework = '[]'::jsonb,
                stage = 'studio',
                updated_at = NOW()
            WHERE id = %s
            """,
            (Jsonb(slides), lesson_id),
        )
        cur.execute("DELETE FROM quiz_questions WHERE lesson_id = %s", (lesson_id,))

        def insert_batch(questions: list[dict[str, Any]], placement: str) -> None:
            for index, question in enumerate(questions):
                cur.execute(
                    """
                    INSERT INTO quiz_questions (
                        lesson_id, order_index, placement, kind, prompt, scenario_note,
                        require_explanation, spec, answer_key, explanation,
                        time_limit_sec, points, concept_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL)
                    """,
                    (
                        lesson_id,
                        index,
                        placement,
                        question["kind"],
                        question["prompt"],
                        question.get("scenarioNote"),
                        bool(question.get("requireExplanation")),
                        Jsonb(question.get("spec") or {}),
                        Jsonb(question.get("answerKey") or {}),
                        question.get("explanation") or "",
                        int(question.get("timeLimitSec") or 20),
                        int(question.get("points") or 1000),
                    ),
                )

        insert_batch(live_questions, "live")
        insert_batch(homework_questions, "homework")
    conn.commit()


def mark_lesson_failed(conn: psycopg.Connection, *, lesson_id: UUID | str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lessons
            SET stage = 'failed',
                updated_at = NOW()
            WHERE id = %s
            """,
            (lesson_id,),
        )
    conn.commit()
