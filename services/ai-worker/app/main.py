from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.llm import model_name
from app.pipeline import IngestionPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oku.worker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pipeline = IngestionPipeline()
    task = asyncio.create_task(pipeline.poll_forever())
    app.state.pipeline = pipeline
    logger.info(
        # The model an admin saves in the web app takes precedence, job by job.
        "ai-worker started default_model=%s pages_at_once=%s poll=%ss",
        model_name(),
        settings.ingest_page_concurrency,
        settings.worker_poll_interval_sec,
    )
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="oku ai-worker", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
