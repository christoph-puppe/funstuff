"""IAP identity, app-level allow-list, and action audit log — the access layer. (From Rhadamanthus.)

IAP authenticates users at the edge. Identity trust: the plain ``X-Goog-Authenticated-User-Email``
header is spoofable if anything reaches the container without passing IAP — set ``IAP_AUDIENCE``
to verify the signed ``x-goog-iap-jwt-assertion`` JWT instead (audience is
``/projects/<num>/global/backendServices/<id>`` behind a GCLB/GKE, or the IAP client id on
Cloud Run). Then a request that bypasses IAP gets NO identity and an active allow-list denies it.

Integration points to adapt per project (marked ▸):
  ▸ get_context_storage() — your storage shim (bucket-held allow-list file)
  ▸ settings — pydantic Settings with iap_audience / allowed_users
  ▸ _ACTIONS — your mutating routes → plain-language action labels

Middleware wiring (see scaffold.md): the gate runs FIRST (registered first), resolves identity in
a worker thread (JWT verify / GCS read must not block the event loop), returns ONLY a static
"No Access" page to denied users (no API shape leaks), keeps /healthz open for probes, and emits
the audit line as a BackgroundTask after the response.
"""

import json
import sys
import time

from app.deps import get_context_storage  # ▸ your storage shim
from app.settings import settings         # ▸ your Settings

_IAP_EMAIL_HEADER = "x-goog-authenticated-user-email"
_IAP_JWT_HEADER = "x-goog-iap-jwt-assertion"
_IAP_ISSUER = "https://cloud.google.com/iap"
_IAP_CERTS_URL = "https://www.gstatic.com/iap/verify/public_key"
_IAP_CERTS_TTL = 3600.0                      # seconds to cache IAP's public signing keys
_ALLOWLIST_KEY = "config/allowed-users.txt"  # one email per line; '#' comments; in the bucket
_ALLOWLIST_TTL = 30.0                        # seconds to cache the effective allow-list
_allow_cache: tuple[float, frozenset[str]] | None = None
_iap_certs_cache: tuple[float, dict] | None = None


def _iap_certs() -> dict:
    global _iap_certs_cache
    now = time.monotonic()
    if _iap_certs_cache and now - _iap_certs_cache[0] < _IAP_CERTS_TTL:
        return _iap_certs_cache[1]
    import urllib.request

    with urllib.request.urlopen(_IAP_CERTS_URL, timeout=10) as resp:
        certs = json.loads(resp.read())
    _iap_certs_cache = (now, certs)
    return certs


def _verified_user(request) -> str:
    """Email from a signature-verified IAP JWT, or ``""`` when the token is absent, invalid,
    expired, or minted for another audience — no identity, so an active allow-list denies."""
    token = request.headers.get(_IAP_JWT_HEADER, "")
    if not token:
        return ""
    try:
        from google.auth import jwt as google_jwt

        claims = google_jwt.decode(token, certs=_iap_certs(), audience=settings.iap_audience)
    except Exception:  # noqa: BLE001 — bad signature / expired / wrong audience / keys unreachable
        return ""
    if claims.get("iss") != _IAP_ISSUER:
        return ""
    return str(claims.get("email") or "").strip().lower()


def current_user(request) -> str:
    """The IAP-verified user email (lower-case), or ``""`` when there is none. With IAP_AUDIENCE
    set, only a cryptographically valid IAP JWT yields an identity — the plain header is ignored."""
    if settings.iap_audience:
        return _verified_user(request)
    raw = request.headers.get(_IAP_EMAIL_HEADER, "")
    return raw.split(":", 1)[-1].strip().lower() if raw else ""  # strip "accounts.google.com:"


def _env_allowlist() -> set[str]:
    return {e.strip().lower() for e in settings.allowed_users.split(",") if e.strip()}


def _is_not_found(exc: BaseException) -> bool:
    return isinstance(exc, FileNotFoundError) or getattr(exc, "code", None) == 404


def _file_allowlist() -> set[str]:
    try:
        text = get_context_storage().read_text(_ALLOWLIST_KEY)
    except Exception as exc:  # noqa: BLE001
        if _is_not_found(exc):
            return set()  # no file ⇒ no file entries (an env list may still apply)
        raise  # storage unreachable ⇒ allowlist() serves the stale list or callers fail closed
    users: set[str] = set()
    for line in text.splitlines():
        entry = line.split("#", 1)[0].strip().lower()
        if entry:
            users.add(entry)
    return users


def allowlist(*, force: bool = False) -> frozenset[str]:
    """Effective allow-list = env ∪ bucket file, cached ~30s. Empty ⇒ enforcement is **OFF**.
    On a storage error the last known list is served (stale beats fail-open); with nothing cached
    yet it raises and callers fail closed."""
    global _allow_cache
    now = time.monotonic()
    if not force and _allow_cache and now - _allow_cache[0] < _ALLOWLIST_TTL:
        return _allow_cache[1]
    try:
        users = frozenset(_env_allowlist() | _file_allowlist())
    except Exception:  # noqa: BLE001
        if _allow_cache is not None:
            # Re-stamp so the stale copy is served for another TTL: one failed probe per window,
            # not one per request (a stuck GCS read per request would stall the thread pool).
            _allow_cache = (now, _allow_cache[1])
            return _allow_cache[1]
        raise
    _allow_cache = (now, users)
    return users


def is_authorized(user: str) -> bool:
    """True when the allow-list is empty (off) or ``user`` is on it. **Fails closed**: an active
    allow-list with no identified user is denied — and so is everyone while the list is unreadable
    with nothing cached yet."""
    try:
        allowed = allowlist()
    except Exception:  # noqa: BLE001 — list unreadable and no cache: deny, don't admit everyone
        return False
    if not allowed:
        return True
    return bool(user) and user in allowed


# ▸ Mutating endpoint → plain-language action, keyed by the EXACT (method, route path template).
# Resolved from the *matched* route — never a prefix scan of the raw path — so a 405 or unrouted
# path can't borrow a neighbour's verb. Add a pinning test that fails CI when a new mutating
# /api route has no entry here.
_ACTIONS: dict[tuple[str, str], str] = {
    ("POST",   "/api/analyze"):        "run assessment",        # examples — replace per app
    ("DELETE", "/api/runs/{run_id}"):  "delete assessment run",
}


def _action(request) -> str:
    """Plain-language action from the matched route. A request that never routed (denied probe,
    404/405) degrades to "METHOD path" — we don't guess a verb it might not have performed."""
    route = request.scope.get("route")
    path_format = getattr(route, "path_format", None)
    if path_format:
        label = _ACTIONS.get((request.method, path_format))
        if label:
            return label
    return f"{request.method} {request.url.path}"


def record_audit(request, **fields) -> None:
    """Attach 'what data' context to the current request (catalog, run id created, …) so the audit
    line says not just *that* the user acted but *on what*. ``None`` values are dropped; call
    repeatedly to accumulate."""
    detail = getattr(request.state, "audit_detail", None)
    if not isinstance(detail, dict):
        detail = {}
        request.state.audit_detail = detail
    detail.update({k: v for k, v in fields.items() if v is not None})


async def audit(request, user: str, *, status: int, denied: bool = False) -> None:
    """Emit one "who did what" record to stdout (→ Cloud Logging) as a single JSON line. The
    status distinguishes attempted (4xx/5xx) from done (2xx). ``async`` so Starlette's
    BackgroundTask awaits it inline, serialising concurrent emits. Never fatal."""
    payload = {
        "severity": "WARNING" if denied else "NOTICE",
        "event": "audit",
        "user": user or "anonymous",
        "action": _action(request),
        "path": request.url.path,
        "status": status,
    }
    detail = getattr(request.state, "audit_detail", None)
    if isinstance(detail, dict):
        payload.update({k: v for k, v in detail.items() if k not in payload})
    if denied:
        payload["denied"] = True
    # One write call → one line, never interleaved. default=str keeps the record total: a
    # non-serialisable value degrades to its repr instead of erasing the line.
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")
    sys.stdout.flush()
