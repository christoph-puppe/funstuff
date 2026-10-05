"""google-genai (Vertex / Agent Platform) client wrapper — the proven template.

Lifted from Rhadamanthus engine/vertex/client.py (validated against google-genai 2.x).
Covers: structured JSON output, file parts, context caching, thinking levels, batch jobs with
cancel and a hard deadline, transient-only retries. All google imports are lazy so importing this
module needs no credentials.

Adapt per project: drop the methods you don't need; keep _is_recoverable/_retrying as-is.
"""

import json
import logging
import time

logger = logging.getLogger(__name__)

# Batch jobs in one of these states will not change any more.
_BATCH_DONE = frozenset({"JOB_STATE_SUCCEEDED", "JOB_STATE_PARTIALLY_SUCCEEDED", "JOB_STATE_FAILED",
                         "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"})

# Gemini 3.x uses thinking_level; 2.5 uses thinking_budget (tokens). Pick by model generation.
_THINKING_LEVEL = {"minimal": "minimal", "off": "minimal", "low": "low", "medium": "medium",
                   "high": "high", "max": "high"}
_THINKING_BUDGET = {"minimal": 512, "off": 0, "low": 4096, "medium": 16384, "high": 32768, "max": -1}


def _is_recoverable(exc: BaseException) -> bool:
    """Retry only transient failures: 429 (rate limit / quota), 5xx, and timeouts/connection drops.
    Permanent errors (400 invalid request, 401/403 auth, 404) are raised immediately — retrying
    wastes quota and time (and hides the real error)."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(code, int):
        return code == 429 or 500 <= code < 600
    msg = str(exc).lower()
    return any(s in msg for s in (
        "429", "resource_exhausted", "rate limit", "quota",
        "503", "unavailable", "500", "internal", "502", "504",
        "deadline", "timeout", "timed out", "connection", "reset",
    ))


def _thinking_config(model: str, level: str):
    from google.genai import types

    m = model or ""
    try:
        if "gemini-3" in m or "gemini-4" in m:
            lvl = _THINKING_LEVEL.get(level, "high")
            # 3.x *pro* previews don't offer "minimal" — clamp up to "low" so a UI default meant
            # for flash doesn't 400 the pro posture.
            if "pro" in m and lvl == "minimal":
                lvl = "low"
            return types.ThinkingConfig(thinking_level=lvl)
        return types.ThinkingConfig(thinking_budget=_THINKING_BUDGET.get(level, -1))
    except TypeError:
        return None


def _retrying(fn):
    """Run ``fn`` with the shared recoverable-error retry policy: up to 3 retries (4 attempts) on
    429/5xx/timeouts with exponential backoff; permanent errors reraise at once."""
    from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

    @retry(retry=retry_if_exception(_is_recoverable), stop=stop_after_attempt(4),
           wait=wait_exponential(min=2, max=30), reraise=True)
    def _run():
        return fn()

    return _run()


class VertexClient:
    """One model for every task; quality is dialed via thinking level, not a model zoo."""

    def __init__(self, project: str, location: str, model: str, api_endpoint: str = ""):
        self.project = project
        self.location = location
        self.model = model
        self.api_endpoint = api_endpoint  # e.g. https://aiplatform.eu.rep.googleapis.com (EU residency)
        self._client = None

    def _genai(self):
        if self._client is None:
            from google import genai  # lazy

            kwargs = {"project": self.project, "location": self.location}
            if self.api_endpoint:
                # Route through the given regionalized endpoint (data-residency host) instead of
                # the SDK default. `base_url` overrides the API host for every call.
                from google.genai import types
                kwargs["http_options"] = types.HttpOptions(base_url=self.api_endpoint)
            # Agent Platform SDKs: enterprise=True. Fall back to vertexai=True on older SDKs.
            try:
                self._client = genai.Client(enterprise=True, **kwargs)
            except TypeError:
                self._client = genai.Client(vertexai=True, **kwargs)
        return self._client

    def _config(self, schema, thinking: str, temperature: float, cached_content: str | None,
                model: str, system_instruction: str | None = None):
        from google.genai import types

        base = {"response_mime_type": "application/json", "temperature": temperature}
        tc = _thinking_config(model, thinking)
        if tc is not None:
            base["thinking_config"] = tc
        if cached_content:
            base["cached_content"] = cached_content
        if system_instruction:
            base["system_instruction"] = system_instruction
        try:
            return types.GenerateContentConfig(response_json_schema=schema, **base)
        except TypeError:  # older SDKs
            return types.GenerateContentConfig(response_schema=schema, **base)

    def generate_json(self, prompt: str, schema: dict, *, parts=None, model: str | None = None,
                      thinking: str = "max", temperature: float = 1.0,
                      cached_content: str | None = None, system_instruction: str | None = None):
        """Call Gemini with structured output, return parsed JSON. ``parts`` = [(bytes, mime), …].
        temperature=1.0 stays the default — lower degrades Gemini 3.x reasoning."""
        from google.genai import types

        model = model or self.model
        client = self._genai()
        contents = [types.Part.from_bytes(data=d, mime_type=m) for d, m in (parts or [])]
        contents.append(prompt)
        config = self._config(schema, thinking, temperature, cached_content, model,
                              system_instruction)

        resp = _retrying(lambda: client.models.generate_content(
            model=model, contents=contents, config=config))
        return json.loads(getattr(resp, "text", None) or "")

    def count_tokens(self, text: str, *, model: str | None = None) -> int:
        """Exact token count via the model — used to size chunks against the context budget."""
        resp = _retrying(lambda: self._genai().models.count_tokens(
            model=model or self.model, contents=[text]))
        return int(getattr(resp, "total_tokens", 0) or 0)

    # ── Context caching (corpus/system_instruction cached once, reused per call) ──
    def create_cache(self, *, model: str | None = None, ttl: str = "3600s",
                     contents=None, system_instruction: str | None = None,
                     display_name: str | None = None) -> str:
        """Raises below the model's minimum cache size — caller falls back to inline.
        Key ``display_name`` by a content hash to enable reuse via ``find_cache_by_display_name``."""
        from google.genai import types

        cache = _retrying(lambda: self._genai().caches.create(
            model=model or self.model,
            config=types.CreateCachedContentConfig(
                contents=contents, system_instruction=system_instruction,
                display_name=display_name, ttl=ttl,
            ),
        ))
        return cache.name

    def delete_cache(self, name: str) -> None:
        try:
            _retrying(lambda: self._genai().caches.delete(name=name))
        except Exception:  # noqa: BLE001 — best-effort cleanup
            pass

    def find_cache_by_display_name(self, display_name: str) -> dict | None:
        """Return an unexpired cache matching display_name (hash-based reuse), else None.
        caches.list() returns only live caches, so a match is reusable."""
        try:
            for c in _retrying(lambda: list(self._genai().caches.list())):
                if getattr(c, "display_name", None) == display_name:
                    return {"name": c.name, "expireTime": str(getattr(c, "expire_time", None))}
        except Exception:  # noqa: BLE001
            return None
        return None

    # ── Batch mode (async; ~50% cost, no rate-limit backoff; Vertex REQUIRES GCS JSONL) ──
    def batch_create(self, *, model: str, src_uri: str, dest_uri: str,
                     display_name: str | None = None) -> str:
        """Submit a batch job (GCS JSONL ``src_uri`` → ``dest_uri`` folder); return the job name.
        On Vertex the inputs/outputs MUST be GCS (inline requests are Developer-API only)."""
        from google.genai import types

        job = _retrying(lambda: self._genai().batches.create(
            model=model, src=src_uri,
            config=types.CreateBatchJobConfig(dest=dest_uri, display_name=display_name),
        ))
        return job.name

    def batch_get(self, name: str) -> dict:
        """Poll a batch job → ``{state, dest, error}``. ``state`` is the ``JOB_STATE_*`` string."""
        job = _retrying(lambda: self._genai().batches.get(name=name))
        state = getattr(job.state, "name", None) or str(job.state or "")
        dest = None
        d = getattr(job, "dest", None)
        if d is not None:
            dest = getattr(d, "gcs_uri", None) or getattr(d, "file_name", None)
        err = getattr(job, "error", None)
        return {"state": state, "dest": dest, "error": str(err) if err else ""}

    def batch_cancel(self, name: str) -> None:
        """Cancel a batch job. Work already completed stays under the destination prefix."""
        _retrying(lambda: self._genai().batches.cancel(name=name))

    def batch_wait(self, name: str, *, deadline_s: float = 300.0, poll_s: float = 10.0,
                   cancel_grace_s: float = 60.0) -> dict:
        """Poll until the job is done or ``deadline_s`` is over (core rule: a batch gets 300 s).

        Call it right after ``batch_create``; the clock starts here. On the deadline the job is
        cancelled, not abandoned (an abandoned job can finish later and be billed anyway), then
        polled for up to ``cancel_grace_s`` so the partial output is settled before it is read.

        Returns ``batch_get``'s dict plus ``deadline_hit``. Unless the state is
        ``JOB_STATE_SUCCEEDED``, the caller reads the result lines that did land under ``dest``
        and sends the items without a result through the standard path."""
        info = self._batch_poll(name, deadline_s, poll_s)
        if info["state"] in _BATCH_DONE:
            return {**info, "deadline_hit": False}
        logger.warning("batch %s not done after %.0f s (state %s): cancelling", name, deadline_s,
                       info["state"])
        try:
            self.batch_cancel(name)
        except Exception:  # noqa: BLE001 — re-raised below unless the job finished meanwhile
            # The job can finish between the last poll and the cancel: nothing left to cancel.
            info = self.batch_get(name)
            if info["state"] not in _BATCH_DONE:
                raise
            return {**info, "deadline_hit": False}
        return {**self._batch_poll(name, cancel_grace_s, poll_s), "deadline_hit": True}

    def _batch_poll(self, name: str, limit_s: float, poll_s: float) -> dict:
        """``batch_get`` every ``poll_s`` until the job is done or ``limit_s`` has passed."""
        t0 = time.monotonic()
        info = self.batch_get(name)
        while info["state"] not in _BATCH_DONE:
            left = limit_s - (time.monotonic() - t0)
            if left <= 0:
                break
            time.sleep(min(poll_s, left))
            info = self.batch_get(name)
        return info
