"""Surface backend (Vertex/GCS) failures to the user instead of hiding them. (From Rhadamanthus.)

Routers must never swallow backend errors into a bland "… failed" 502 — that masks actionable
problems like a Vertex 403 "Vertex AI is forbidden for the project". ``backend_error_detail``
logs the full exception at ERROR (always — independent of LOG_LEVEL) and returns a one-line
reason the router puts in the response, so the user sees *why*.

Usage in a router:
    try:
        result = do_backend_work(...)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=backend_error_detail(e, "briefing generation"))

For SSE streams: yield sse_event("error", {"message": backend_error_detail(e, "assessment")}).

Rules:
  • Keep gateway semantics — upstream failure → 502 with the reason in detail. Never pass the
    upstream 401/403 through when the frontend maps those statuses to app-access states.
  • Safe to show upstream reasons when endpoints sit behind IAP + allow-list (operators only).
  • A frontend that renders ``body.detail || "HTTP " + status`` needs no change.
"""

import logging

logger = logging.getLogger(__name__)


def backend_error_detail(exc: Exception, action: str) -> str:
    """``"<action> failed (<code> <status>): <message>"``. A google-genai ``APIError`` carries
    ``code``, ``status`` (e.g. ``PERMISSION_DENIED``) and a human ``message``; anything else falls
    back to ``str(exc)``. Logs the full exception (with traceback) first."""
    logger.exception("%s failed", action)
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    status = getattr(exc, "status", None)
    message = getattr(exc, "message", None) or str(exc)
    tag = " ".join(str(p) for p in (code, status) if p)
    prefix = f"{action} failed" + (f" ({tag})" if tag else "")
    return f"{prefix}: {message}" if message else prefix
