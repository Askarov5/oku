from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.config import settings


def connect() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)


def claim_job(conn: psycopg.Connection) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM ingestion_jobs
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
            UPDATE ingestion_jobs
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


def get_setting(conn: psycopg.Connection, key: str) -> Any | None:
    """A value an admin set in the web app, or None when it was never set."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_settings WHERE key = %s", (key,))
            row = cur.fetchone()
    except psycopg.errors.UndefinedTable:
        # The worker is running against a database from before settings existed.
        conn.rollback()
        return None
    conn.commit()
    return row["value"] if row else None


def get_book(conn: psycopg.Connection, book_id: UUID | str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM books WHERE id = %s", (book_id,))
        book = cur.fetchone()
        if not book:
            raise ValueError(f"book not found: {book_id}")
        return book


def get_page(
    conn: psycopg.Connection, book_id: UUID | str, page_number: int
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT * FROM book_pages
            WHERE book_id = %s AND page_number = %s
            """,
            (book_id, page_number),
        )
        return cur.fetchone()


def mark_page(
    conn: psycopg.Connection,
    *,
    book_id: UUID | str,
    page_number: int,
    status: str,
    raw_image_url: str | None = None,
    extracted_json: dict[str, Any] | None = None,
    error_message: str | None = None,
    stage: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE book_pages
            SET status = %s,
                raw_image_url = COALESCE(%s, raw_image_url),
                extracted_json = COALESCE(%s, extracted_json),
                error_message = %s,
                stage = COALESCE(%s, stage),
                updated_at = NOW()
            WHERE book_id = %s AND page_number = %s
            """,
            (
                status,
                raw_image_url,
                Jsonb(extracted_json) if extracted_json is not None else None,
                error_message,
                stage,
                book_id,
                page_number,
            ),
        )
    conn.commit()


def bump_job_progress(
    conn: psycopg.Connection,
    *,
    job_id: UUID | str,
    completed_delta: int = 0,
    failed_delta: int = 0,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_jobs
            SET completed_pages = completed_pages + %s,
                failed_pages = failed_pages + %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (completed_delta, failed_delta, job_id),
        )
    conn.commit()


def finish_job(
    conn: psycopg.Connection,
    *,
    job_id: UUID | str,
    failed_pages: int,
    error: str | None = None,
) -> None:
    status = "completed"
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ingestion_jobs
            SET status = %s,
                failed_pages = %s,
                error = %s,
                finished_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (status, failed_pages, error, job_id),
        )
    conn.commit()


def set_book_review(conn: psycopg.Connection, book_id: UUID | str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE books
            SET status = CASE WHEN status = 'draft' THEN 'review' ELSE status END,
                updated_at = NOW()
            WHERE id = %s
            """,
            (book_id,),
        )
    conn.commit()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
