# New-app scaffold — layout, container, tooling

The proven shape (Rhadamanthus). One repo, one `pyproject.toml`, one image; the web app and every
job CLI run from the same image with different commands.

## Tree

```
appname/
├── app/                    # FastAPI service (the deployed container's default command)
│   ├── main.py             # app = FastAPI(...); middleware; routers; static mount LAST
│   ├── settings.py         # pydantic-settings Settings singleton (mirrors .env.example)
│   ├── deps.py             # runtime wiring: client/storage getters (LRU-cached), posture switch
│   ├── access.py           # IAP identity + allow-list + audit (see iap_access.py)
│   ├── errors.py           # backend_error_detail (see errors.py)
│   ├── sse.py              # sse_event / sse_comment helpers
│   └── routers/*.py        # one file per resource
├── engine/                 # shared library: model client wrapper, storage shim, pipelines
│   ├── logging_setup.py    # configure_logging (see logging_setup.py)
│   ├── vertex/client.py    # VertexClient (see vertex_client.py)
│   └── storage/            # make_storage("local"|"gcs") — one interface, dev needs zero GCP
├── <son1>/ <son2>/ …       # job CLIs (python -m <name>), named as kin of the app;
│   └── main.py __main__.py #   they call the backend API with minted IAP id-tokens
├── frontend/               # static no-build JS/CSS/HTML served by the app (strict CSP, no CDN)
├── prompts/                # prompt templates (versioned, wording changes need no tests)
├── tests/                  # offline: fakes + monkeypatch + TestClient
├── terraform/cloud-run/  terraform/gke/   # two deploy targets (see terraform.md)
├── Dockerfile  justfile  pyproject.toml  .env.example
└── README.md  architecture.md  user-manual.md
```

## pyproject.toml skeleton

```toml
[project]
name = "appname"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi", "uvicorn", "python-multipart",
    "google-genai>=2.0", "google-cloud-storage>=2.16",
    "pydantic-settings", "requests>=2.31", "tenacity",
]

[dependency-groups]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "ruff", "httpx"]

[tool.ruff]
line-length = 110

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Dockerfile (the tricks that matter)

```dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_SYSTEM_PYTHON=1
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /srv
# Dependencies first (layer caching); uv.lock used when present.
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen
# Application: app + engine + every CLI sibling + frontend + prompts + bundled data.
COPY app ./app
COPY engine ./engine
# COPY <son1> ./<son1> …
COPY frontend ./frontend
RUN addgroup --system app && adduser --system --ingroup app app && chown -R app:app /srv
USER app
ENV PORT=8080
EXPOSE 8080
# Exec the venv interpreter directly: `uv run` would re-sync and needs a writable HOME/cache,
# which the non-root user lacks on Cloud Run. uv sync built /srv/.venv at image-build time.
CMD ["sh", "-c", "/srv/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

Jobs reuse this image with a different command: `/srv/.venv/bin/python -m <son1> …`.

## justfile

```just
set shell := ["bash", "-cu"]

default:
    @just --list
sync:
    uv sync
# Dev server, UI + API at http://localhost:8080 — STORAGE_BACKEND=local, zero GCP needed.
dev:
    uv run python -m uvicorn app.main:app --reload --port 8080
test:
    uv run pytest -q
lint:
    uv run ruff check .
fmt:
    uv run ruff format .
build:
    docker build -t appname:dev .
```

## app/main.py wiring order (order is load-bearing)

1. `configure_logging(settings.log_level)` at import time — before anything logs.
2. Access-gate middleware registered FIRST (so the security-headers middleware, added after,
   wraps it): resolve identity in `asyncio.to_thread` (JWT verify / GCS read must not block the
   event loop); denied → the static No-Access page only; `/healthz` carve-out; audit emitted as
   a `BackgroundTask` after the response (500s audited in an `except` + re-raise).
3. Security-headers middleware: CSP `default-src 'self'`, nosniff, DENY frames, no-cache on SPA
   assets (redeploys picked up immediately; ETag makes it a cheap 304).
4. Rate-limit + same-origin checks on mutating requests (AFTER the gate — denied users must never
   see the JSON error shape).
5. API routers, then the static frontend mount LAST (catch-all `html=True`).

## .env.example skeleton

Every Settings field appears here AND in the README config table — the three stay in sync.

```bash
# --- GCP / Vertex ---
GCP_PROJECT=
VERTEX_LOCATION=eu          # eu (EU-resident, endpoint derived) | europe-west3 | global
VERTEX_API_ENDPOINT=        # empty = derived from location; set only to override
GEMINI_MODEL=gemini-3.5-flash
# --- Access ---
ALLOWED_USERS=              # comma-separated; empty = allow-list OFF (IAP alone)
IAP_AUDIENCE=               # set ⇒ verify the signed IAP JWT, not the spoofable header
# --- Storage ---
STORAGE_BACKEND=local       # local (./.data shim, no GCP) | gcs
# --- Logging ---
LOG_LEVEL=INFO              # DEBUG surfaces every backend call (httpx/httpcore, urllib3)
# --- Build ---
BUILD_VERSION=0.1.0
```

## Docs trio skeletons

- **README.md** (admins): what it is (3 lines) → quickstart local → deploy (both TF targets) →
  **config table: every env var** (Variable | Example | Purpose) → postures → ops runbook
  (allow-list, audit retention, LOG_LEVEL debugging) → API reference.
- **architecture.md** (coders): component map → data flow → the decisions *and why* (one model +
  thinking levels, one bucket + key prefixes, CLIs via API not backends, posture switch).
- **user-manual.md** (users): what it does → each page/flow with a screenshot-level walkthrough →
  the CLI siblings and when to use which.
