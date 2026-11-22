# oku

Centralized curriculum education platform. **Phase 1:** PDF → digital library for Kyrgyzstan Grade 9 Political Geography (`ky` / `ru`).

## Stack

| Path | Role |
| --- | --- |
| `apps/web` | **Next.js** (App Router) + Tailwind admin library UI & API |
| `services/ai-worker` | FastAPI PDF ingestion worker (PyMuPDF + mock/Gemini vision) |
| `packages/db` | Drizzle schema + migrations |
| `packages/shared-types` | Block AST contract (JSON Schema + Zod + Pydantic) |
| `packages/ui` | Shared admin primitives & design tokens |

## Quick start

```bash
cp .env.example .env
# STORAGE_DRIVER=local and MOCK_LLM=true are the local defaults

docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter @oku/web dev
```

In another terminal:

```bash
cd services/ai-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
pip install fastapi "uvicorn[standard]" "psycopg[binary,pool]" boto3 pymupdf pillow pydantic pydantic-settings httpx python-multipart jsonschema pytest pytest-asyncio
pip install -e . --no-deps
$env:STORAGE_DRIVER="local"
$env:MOCK_LLM="true"
$env:DATABASE_URL="postgresql://oku:oku@localhost:5432/oku"
uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:3000/admin/library](http://localhost:3000/admin/library) and sign in with `ADMIN_TOKEN` (default `dev-admin-token`).

For real extraction instead of mock text, `pip install litellm`, start the worker with `MOCK_LLM="false"` and `GEMINI_API_KEY` set, and put the same key in `apps/web/.env.local` so the admin can list the models it may use. The model is chosen under **Extraction model** in the admin library and applies to extraction jobs started after the change; the worker's `LLM_MODEL` is only the fallback when none is saved.

Local object storage writes to `.r2-local/` and is served by Next.js at `/api/media/*`. Set `STORAGE_DRIVER=r2` plus R2/MinIO env vars when you have S3-compatible storage.

## Tests

```bash
pnpm --filter @oku/shared-types test
pnpm --filter @oku/web test
cd services/ai-worker && .\.venv\Scripts\pytest -q
```
