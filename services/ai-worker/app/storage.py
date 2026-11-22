from __future__ import annotations

import os
from pathlib import Path

import boto3
from botocore.client import Config

from app.config import settings


def use_local_storage() -> bool:
    return (os.getenv("STORAGE_DRIVER") or "local").lower() == "local"


def local_root() -> Path:
    """The folder local files live in.

    A relative LOCAL_STORAGE_DIR is read from the repo root. The worker is
    started from services/ai-worker, and a `.r2-local` beside that folder is
    empty: the web app keeps the files in the repo's `.r2-local`.
    """
    repo_root = Path(__file__).resolve().parents[3]
    configured = os.getenv("LOCAL_STORAGE_DIR")
    if not configured:
        return repo_root / ".r2-local"
    path = Path(configured)
    if not path.is_absolute():
        path = repo_root / path
    return path.resolve()


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={
                "addressing_style": "path" if settings.r2_force_path_style else "auto"
            },
        ),
    )


def public_url(key: str) -> str:
    if use_local_storage():
        return f"/api/media/{key}"
    return f"{settings.r2_public_base_url.rstrip('/')}/{key}"


def download_bytes(key_or_url: str) -> bytes:
    if use_local_storage():
        key = key_or_url
        if key_or_url.startswith("/api/media/"):
            key = key_or_url[len("/api/media/") :]
        path = local_root() / key
        return path.read_bytes()

    client = s3_client()
    key = key_or_url
    prefix = settings.r2_public_base_url.rstrip("/") + "/"
    if key_or_url.startswith(prefix):
        key = key_or_url[len(prefix) :]
    elif key_or_url.startswith("http"):
        parts = key_or_url.split(f"/{settings.r2_bucket}/", 1)
        if len(parts) == 2:
            key = parts[1]
    obj = client.get_object(Bucket=settings.r2_bucket, Key=key)
    return obj["Body"].read()


def upload_bytes(key: str, body: bytes, content_type: str) -> str:
    if use_local_storage():
        path = local_root() / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return public_url(key)

    client = s3_client()
    client.put_object(
        Bucket=settings.r2_bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    return public_url(key)
