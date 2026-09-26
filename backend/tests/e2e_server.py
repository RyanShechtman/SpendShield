"""Isolated browser-test server; never imported by the normal application."""

import os
from pathlib import Path

if os.getenv("SPENDSHIELD_E2E") != "1" or Path(os.getenv("SPENDSHIELD_DB", "")).name != "e2e.sqlite3":
    raise RuntimeError("Browser tests require an isolated e2e.sqlite3 database.")

from backend.main import app  # noqa: E402
from backend import store  # noqa: E402


@app.post("/api/test/reset")
def reset_personal_test():
    with store.connection() as db:
        store.fresh_profile(db)
    return {"ok": True}


# The frontend's root static mount must stay after this test-only route.
app.router.routes.insert(0, app.router.routes.pop())
