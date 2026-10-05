"""One-call logging setup shared by the web app and the CLIs. (Verbatim from Rhadamanthus.)

The app hand-instruments nothing: lowering the root level is enough to make every backend
client emit its own wire logs. Set ``LOG_LEVEL=DEBUG`` (customer environment) to see the
failing calls end to end —
  • Vertex/Gemini (google-genai): the request line + status via ``httpx``/``httpcore``;
  • auth token minting: ``google.auth`` + ``urllib3``;
  • GCS: ``google.api_core`` / ``google.cloud`` / ``urllib3``;
  • ``requests``-based HTTP clients: ``urllib3``.
Default level is INFO (one line per HTTP request, negligible noise).

Wire it at EVERY entrypoint:
  • web app: ``configure_logging(settings.log_level)`` at import time in main.py;
  • each CLI: ``configure_logging()`` at the top of ``main()`` (reads LOG_LEVEL env).
Document LOG_LEVEL in .env.example + the README config table; it's read at process start —
restart to apply.
"""

import logging
import os

_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging(level: str | None = None) -> None:
    """Configure the root logger once. ``level`` wins; otherwise ``LOG_LEVEL`` env; else INFO.

    ``force=True`` re-installs our handler even if something (e.g. uvicorn) already configured
    logging, so the chosen level always takes effect. Logs go to stderr — CLIs print their
    machine JSON to stdout, which stays clean."""
    resolved = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    logging.basicConfig(level=resolved, format=_FORMAT, force=True)
