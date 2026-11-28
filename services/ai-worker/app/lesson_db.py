from __future__ import annotations

from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb


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
    homework: list[dict[str, Any]],
    questions: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lessons
            SET slides = %s,
                homework = %s,
                stage = 'studio',
                updated_at = NOW()
            WHERE id = %s
            """,
            (Jsonb(slides), Jsonb(homework), lesson_id),
        )
        cur.execute("DELETE FROM quiz_questions WHERE lesson_id = %s", (lesson_id,))
        for index, question in enumerate(questions):
            correct = next(
                (choice["id"] for choice in question["choices"] if choice.get("isCorrect")),
                question["choices"][0]["id"],
            )
            choices = [
                {
                    "id": choice["id"],
                    "shape": choice["shape"],
                    "text": choice["text"],
                }
                for choice in question["choices"]
            ]
            cur.execute(
                """
                INSERT INTO quiz_questions (
                    lesson_id, order_index, prompt, scenario_note, choices,
                    correct_choice_id, explanation, time_limit_sec, points, concept_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL)
                """,
                (
                    lesson_id,
                    index,
                    question["prompt"],
                    question.get("scenarioNote"),
                    Jsonb(choices),
                    correct,
                    question.get("explanation") or "",
                    int(question.get("timeLimitSec") or 20),
                    int(question.get("points") or 1000),
                ),
            )
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
