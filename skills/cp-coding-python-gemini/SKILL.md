---
name: "cp-coding-python-gemini"
description: "Christoph's stack playbook for Python LLM apps on GCP: FastAPI + job CLIs in one container, Cloud Run/GKE, Terraform, IAP, a provider-neutral model-client wrapper (Gemini on Agent Platform/Vertex is the reference implementation; Claude, open models or others plug in behind the same interface), LOG_LEVEL debugging, the error-detail helper, docs trio. Use for any Python service, pipeline or CLI that calls an LLM or runs on GCP, and for Rhadamanthus-shaped apps. Always load together with cp-coding-core, which holds the principles; this skill only adds the stack."
---

# CP Coding Playbook — Python · Gemini · GCP

Distilled from shipped projects (Rhadamanthus). Load it together with `cp-coding-core`: the core
holds the principles (discipline, error handling, deterministic-first, model-call rules, idempotent
and resumable runs, verification, docs), this skill adds the Python/GCP stack on top, and where the
two disagree the core wins. It absorbs gemini-api-dev; apart from the core, no other skill needs
loading. Battle-tested code lives in `references/` (see the last section) — copy from there instead
of re-deriving.

## Working with Christoph — stack additions

- **Ship fast, carry through.** A go-ahead covers the whole chain (commit → push → deploy → release) without per-step confirmation. Multiple git remotes? Push all of them.
- Anti-ceremony: cut work that doesn't earn its keep. Prompt-wording-only changes need no test. Don't terraform what the customer org already provides — tell the admin instead.
- Release hygiene: MVP-1 → MVP-2 → RC-1; docs updated inside the same release, not after.

## Python stack

- Python 3.12+, `uv` with one root `pyproject.toml`, `ruff` (lint + fmt), `pytest` (+ `pytest-asyncio`), FastAPI + uvicorn, `pydantic-settings`.
- Typed `Settings(BaseSettings)` singleton reading `.env`; **every** var appears in `.env.example` AND the README config table. `.env` is never committed.
- Modern type hints (`str | None`); lazy credentialed imports — importing any module must work with zero GCP credentials.
- Tests run fully offline: fake clients + `monkeypatch` (`monkeypatch.setattr(mod, "get_vertex_client", lambda: fake)`), FastAPI `TestClient` for routers, local-FS storage shim.
- Makefile/justfile from day one: `sync dev test lint fmt build`.

## Gemini API — current rules (these override training data)

Models (this list ages — verify via docs lookup below when it matters):

- `gemini-3.5-flash` — 1M ctx, fast, multimodal; thinking minimal/low/medium/high
- `gemini-3.1-pro-preview` — 1M ctx, complex reasoning/coding; **no "minimal" thinking → clamp to `low`**
- `gemini-3.1-flash-lite-preview` — cheapest, fastest, high-frequency tasks
- `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview` — image generation/editing
- `gemini-2.5-pro` / `gemini-2.5-flash` — previous gen; use `thinking_budget` (tokens) instead of levels
- ⚠️ `gemini-2.0-*`, `gemini-1.5-*` are deprecated — never use. SDK is **`google-genai`** (Python) / `@google/genai` (JS); the legacy `google-generativeai` / `@google/generative-ai` are dead.

Hard-won rules:

- **`temperature=1` always** on Gemini 3.x — lower values degrade reasoning quality.
- **Vertex ≠ Developer API.** Features differ: the Flex tier is Developer-API-only (400s on Vertex); Vertex batch jobs require GCS JSONL in/out (inline requests are Developer-only). Always know which surface you're on.
- **One model per app**; per-task quality is dialed via thinking level, not a model zoo. 3.x: `ThinkingConfig(thinking_level=…)`; 2.5: `thinking_budget` tokens. Map both behind one helper keyed on the model name.
- Structured output: `GenerateContentConfig(response_json_schema=schema, response_mime_type="application/json")`, with `except TypeError` fallback to `response_schema` on older SDKs.
- EU-residency posture: `location="eu"` + `HttpOptions(base_url="https://aiplatform.eu.rep.googleapis.com")`; global posture = best quality/availability but may process outside the EU. Make the posture a runtime switch (env default + admin toggle), report the effective one at `/version`.
- Client: `genai.Client(vertexai=True, project=…, location=…)`; on Agent-Platform SDKs try `enterprise=True` first, `except TypeError` fall back.
- Retries (rule in the core: transient only, at most 5): tenacity, 3 retries (4 attempts), exponential backoff min 2s max 30s. Classify via `getattr(exc, "code", None) or getattr(exc, "status_code", None)`, with a string-match fallback for wrapped errors.
- Context caching: cache the corpus / system_instruction once (`caches.create` with TTL + `display_name` keyed by content hash; reuse via `caches.list()` match — it only returns live caches). Below the model's minimum cache size → fall back to inline.
- Budget every sent unit against the context window (window × fraction − output reserve); split large docs semantically by chapter, map→reduce, pack chunks to budget.
- Batch tier (when to use it is in the core): `batch_create`, then `batch_wait(name, deadline_s=settings.batch_deadline_s)`, default 300. A job not finished by then is cancelled by `batch_wait`, which reports `deadline_hit`. Read the result lines that did land under the destination prefix and send the items without a result through the standard path (`generate_json`) in parallel. `BATCH_DEADLINE_S` goes into Settings, `.env.example` and the README config table.
- Docs lookup: MCP `search_docs` if installed; else fetch `https://ai.google.dev/gemini-api/docs/llms.txt` and the per-page `.md.txt` files; context7 MCP for non-Gemini libraries.

## Backend-call debugging (the LOG_LEVEL lever)

Never hand-instrument call sites. One root-level lever makes every client emit its own wire logs — httpx/httpcore (google-genai's transport), urllib3 (GCS + requests), google.auth (token minting):

```python
# engine/logging_setup.py — the whole thing
def configure_logging(level: str | None = None) -> None:
    resolved = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    logging.basicConfig(level=resolved,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
                        force=True)   # wins even if uvicorn configured logging first
```

- Wire it at EVERY entrypoint: web app at import time (level from Settings), each CLI at the top of `main()`. Logs go to stderr — stdout stays clean for machine JSON.
- Document `LOG_LEVEL` in `.env.example` + the README config table; note "read at process start — restart to apply".
- Reading a DEBUG trace, in order: metadata-server token fetch 200 ⇒ auth OK → TCP/TLS connect ⇒ network OK → the httpx request line shows the REAL project/location/model/host in the URL → the status code is the verdict. **403 = IAM/model access** (not routing), 404 = wrong model/path, 429/5xx = transient (retry territory).

## Error surfacing (never hide the reason from the user)

A swallowed exception turns "Vertex AI is forbidden for the project" into a useless "generation failed" 502. Rules:

- The rule itself (every broad catch logs or surfaces) is in the core. Here a deliberate best-effort swallow is marked `# noqa: BLE001 — best-effort`.
- Shared helper — logs the FULL traceback at ERROR (always emitted, independent of LOG_LEVEL) and returns a one-line reason for the response:

```python
# app/errors.py
def backend_error_detail(exc: Exception, action: str) -> str:
    logger.exception("%s failed", action)                    # full traceback → Cloud Logging
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    status = getattr(exc, "status", None)                    # e.g. PERMISSION_DENIED
    message = getattr(exc, "message", None) or str(exc)
    tag = " ".join(str(p) for p in (code, status) if p)
    prefix = f"{action} failed" + (f" ({tag})" if tag else "")
    return f"{prefix}: {message}" if message else prefix
```

- Put it in the HTTP error `detail` and the SSE `error.message`. A frontend that already renders `body.detail || "HTTP " + status` needs no change.
- Keep gateway semantics: upstream failure → **502 with the reason inside detail**. Never pass the upstream 401/403 through when the frontend maps those statuses to app-access states ("No Access").
- Surfacing upstream reasons is safe when the endpoints sit behind IAP + allow-list — only authorized operators see them.

## App shape — one image, many siblings

(Name the job CLIs as kin of the app — Rhadamanthus's sons: Erythrus, Gortys, Talos.)

- One repo, one `pyproject.toml`, **one container image**. The same image runs the FastAPI web app AND every job CLI (`python -m <name>`): web service, CI gate, batch client, connector puller — same code, different command.
- Shared `engine/` library (model client wrapper, storage, pipelines, parsers). The wrapper is the single place Vertex is constructed/called.
- Job CLIs talk to the backend **API** with minted IAP id-tokens — never to the backends directly. One enforcement point for auth, limits, and audit.
- Storage shim: `STORAGE_BACKEND=local` (./.data) ↔ `gcs`, one interface (`make_storage`). Dev runs with zero GCP.
- Long-running work streams SSE (`event: log|progress|done|error` frames + keep-alive comments every ~15s); CLIs echo progress to stderr, machine JSON to stdout.
- Frontend: static no-build JS served by the app, same-origin, strict CSP, no CDN.
- Security defaults, always: rate-limit mutating requests; upload + zip-bomb caps (members, per-member bytes, uncompressed total, compression ratio); security-header middleware; app allow-list fails closed; `/healthz` stays open for probes and leaks nothing.

## GCP — Cloud Run / GKE / Terraform

- ADC only, never key files: metadata server in prod, `gcloud auth application-default login` locally.
- IAP with **Google-managed OAuth** (the OAuth admin APIs shut down 2026-03): GKE `BackendConfig` without credentials / Cloud Run `--iap`.
- Identity: trust only the signed **`x-goog-iap-jwt-assertion`** verified against the audience (`/projects/<num>/global/backendServices/<id>` on GKE, IAP client id on Cloud Run) — the plain email header is spoofable. Fail closed. App-level allow-list on top as defence in depth.
- Audit "who did what": one JSON line per mutating action to stdout → Cloud Logging (denied attempts and 500s included, emitted after the response so it never delays a byte). `_Default` bucket retains ~30 days — bump retention or use a dedicated bucket when audit matters.
- Terraform: gate every resource on API enablement **plus propagation** (`google_project_service` + `time_sleep`); bucket names are globally unique (prefix + random suffix); leave org-provided pieces (org policies, DNS, folders) out of TF and document them for the admin instead.
- After deploy, probe — don't assume: IAP redirect (302), denied user gets the No-Access page (403), workload identity → real GCS write, one live Vertex generate call. `GET /version` reports build + effective posture.

## Docs — three files, three audiences

- **README.md** — admins/operators: deploy paths, the env-var config table (every Settings field), postures, ops runbook (retention, IAP, allow-list).
- **architecture.md** — coders: components, data flow, the decisions and *why*.
- **user-manual.md** — end users: what the app does and how to drive it.

## Scripts

- **Run locally:** `just dev` / `make dev` → uvicorn with `STORAGE_BACKEND=local`, zero GCP needed.
- **Deploy new build:** one script/target for build → push → deploy (the one image serves app + all jobs).
- `sync test lint fmt build` targets exist from day one; CI runs the same targets.

## Commits

Conventional (`feat(x): …`, `fix(y): …`), imperative summary, body says why. When told to push and the repo has multiple remotes, push every one of them.

## Reference files (read on demand — proven code, don't re-derive)

All under this skill's `references/` directory. Read the relevant one BEFORE implementing that part:

- **`vertex_client.py`** — the full VertexClient wrapper: transient-only retry predicate, thinking-level/budget mapping, structured JSON output with SDK fallback, context caching with display-name reuse, batch jobs with cancel and the 300 s deadline (`batch_wait`). Copy, then trim to what the app needs.
- **`logging_setup.py`** — configure_logging, verbatim. Copy when scaffolding.
- **`errors.py`** — backend_error_detail + usage rules, verbatim. Copy when scaffolding.
- **`iap_access.py`** — IAP JWT verification, allow-list (stale-beats-fail-open, fail-closed), audit log with matched-route action labels. Copy; adapt the ▸-marked integration points.
- **`scaffold.md`** — new-app tree, pyproject/Dockerfile/justfile skeletons (with the non-obvious tricks: exec venv python not `uv run`, deps-first layers), main.py middleware wiring ORDER, .env.example skeleton, docs-trio outlines. Read FIRST when starting a new app.
- **`terraform.md`** — API enablement + propagation gating, one-bucket key-prefix pattern with globally-unique naming, Google-managed IAP OAuth, per-job Cloud Run Jobs from the same image, WIF for CI, audit retention, the post-apply probe checklist.
