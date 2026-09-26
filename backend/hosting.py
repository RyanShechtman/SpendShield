"""Opt-in hosted mode: GitHub identity, opaque sessions and per-account storage."""

import base64
import hashlib
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.concurrency import run_in_threadpool

from . import store

router = APIRouter()
COOKIE = "__Host-spendshield"
STATE_COOKIE = "__Host-spendshield-login"
SESSION_SECONDS = 7 * 86400


def enabled():
    return os.getenv("SPENDSHIELD_MODE", "local") == "hosted"


def origin():
    return os.environ["PUBLIC_ORIGIN"].rstrip("/")


def root():
    return Path(os.environ["SPENDSHIELD_DATA_DIR"])


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def auth_db():
    db = sqlite3.connect(root() / "auth.sqlite3", timeout=10)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    if not enabled():
        return
    for key in (
        "PUBLIC_ORIGIN",
        "SPENDSHIELD_DATA_DIR",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "GEMINI_API_KEY",
    ):
        if not os.getenv(key) or os.getenv(key) == "your_key_here":
            raise RuntimeError(f"Hosted mode requires {key} in private service settings.")
    parsed = urlsplit(origin())
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.port not in (None, 443)
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("PUBLIC_ORIGIN must be an HTTPS origin without a path.")
    if not root().is_absolute():
        raise RuntimeError("SPENDSHIELD_DATA_DIR must be an absolute persistent-disk path.")
    root().mkdir(parents=True, exist_ok=True, mode=0o700)
    with auth_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS login_states (hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
        """)


def session_user(request):
    token = request.cookies.get(COOKIE, "")
    if not token or len(token) > 200:
        return None
    with auth_db() as db:
        row = db.execute(
            "SELECT user_id FROM sessions WHERE hash=? AND expires>?", (digest(token), time.time())
        ).fetchone()
    return row[0] if row else None


def issue_session(user_id):
    token = secrets.token_urlsafe(32)
    with auth_db() as db:
        db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        db.execute(
            "INSERT INTO sessions VALUES(?,?,?)", (digest(token), user_id, int(time.time()) + SESSION_SECONDS)
        )
    return token


def consume_limits(specs):
    """Atomic persistent budgets; retries and multiple workers cannot bypass them."""
    now = int(time.time())
    with auth_db() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM limits WHERE expires<=?", (now,))
        keys = [
            (f"{name}:{now // seconds}", maximum, (now // seconds + 1) * seconds)
            for name, maximum, seconds in specs
        ]
        for key, maximum, _ in keys:
            row = db.execute("SELECT count FROM limits WHERE key=?", (key,)).fetchone()
            if row and row[0] >= maximum:
                return False
        for key, _, expires in keys:
            db.execute(
                "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
                (key, expires),
            )
    return True


def failure(message, status=403):
    return JSONResponse({"detail": message}, status_code=status)


async def boundary(request, call_next):
    if request.url.hostname != urlsplit(origin()).hostname:
        return failure("This host is not allowed.")
    path = request.url.path
    if (
        path in {"/docs", "/redoc", "/openapi.json"}
        or path.startswith("/api/demo")
        or path.startswith("/api/test")
    ):
        return failure("Not found.", 404)
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if request.headers.get("origin") != origin() or request.headers.get("x-spendshield") != "1":
            return failure("Please use SpendShield in its own browser tab.")
    user = await run_in_threadpool(session_user, request)
    public = path in {"/api/health", "/api/auth/session"}
    if path.startswith("/api/") and not public and not user:
        return failure("Please sign in to continue.", 401)
    if path.startswith("/api/") and user:
        if not await run_in_threadpool(consume_limits, [(f"api:{user}", 180, 60)]):
            return failure("Too many requests. Please wait a minute and try again.", 429)
    if path.startswith("/api/ai/") and user:
        budgets = [
            (f"ai-minute:{user}", 6, 60),
            (f"ai-day:{user}", int(os.getenv("AI_USER_DAILY_LIMIT", "30")), 86400),
            ("ai-global", int(os.getenv("AI_GLOBAL_DAILY_LIMIT", "300")), 86400),
        ]
        if not await run_in_threadpool(consume_limits, budgets):
            return failure(
                "The AI request limit has been reached. Try again later; your records remain available.", 429
            )
    if path.startswith("/auth/") and not await run_in_threadpool(consume_limits, [("login-global", 120, 60)]):
        return failure("Sign-in is busy. Please try again in a minute.", 429)
    token = store.user_context.set(user)
    try:
        if user:
            await run_in_threadpool(store.init)
        response = await call_next(request)
    finally:
        store.user_context.reset(token)
    response.headers["Cache-Control"] = "no-store" if path.startswith(("/api/", "/auth/")) else "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    )
    return response


@router.get("/api/auth/session")
def status(request: Request):
    return {"hosted": enabled(), "authenticated": bool(session_user(request)) if enabled() else True}


@router.get("/auth/login")
def login():
    if not enabled():
        return RedirectResponse("/")
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    with auth_db() as db:
        db.execute("DELETE FROM login_states WHERE expires<?", (time.time(),))
        db.execute(
            "INSERT INTO login_states VALUES(?,?,?)", (digest(state), verifier, int(time.time()) + 600)
        )
    params = {
        "client_id": os.environ["GITHUB_CLIENT_ID"],
        "redirect_uri": origin() + "/auth/callback",
        "scope": "",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    response = RedirectResponse(
        "https://github.com/login/oauth/authorize?" + urlencode(params), status_code=302
    )
    response.set_cookie(
        STATE_COOKIE, state, max_age=600, secure=True, httponly=True, samesite="lax", path="/"
    )
    return response


async def github_identity(code, verifier):
    async with httpx.AsyncClient(timeout=15) as client:
        result = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": os.environ["GITHUB_CLIENT_ID"],
                "client_secret": os.environ["GITHUB_CLIENT_SECRET"],
                "code": code,
                "redirect_uri": origin() + "/auth/callback",
                "code_verifier": verifier,
            },
        )
        result.raise_for_status()
        access = result.json().get("access_token")
        if not access:
            raise ValueError("GitHub did not authorize sign-in.")
        result = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access}", "Accept": "application/vnd.github+json"},
        )
        result.raise_for_status()
        identity = result.json().get("id")
        if type(identity) is not int or identity <= 0:
            raise ValueError("GitHub identity could not be verified.")
        # Store no GitHub access tokens, passwords, email addresses or repository grants.
        return digest(f"github:{identity}")


@router.get("/auth/callback")
async def callback(request: Request, state: str = "", code: str = ""):
    if not enabled():
        return RedirectResponse("/")
    failed = RedirectResponse("/?signin=failed", status_code=303)
    failed.delete_cookie(STATE_COOKIE, secure=True, httponly=True, samesite="lax", path="/")
    if (
        not state
        or len(state) > 200
        or not code
        or len(code) > 1000
        or not secrets.compare_digest(state, request.cookies.get(STATE_COOKIE, ""))
    ):
        return failed
    with auth_db() as db:
        db.execute("BEGIN IMMEDIATE")
        saved = db.execute(
            "SELECT verifier FROM login_states WHERE hash=? AND expires>?", (digest(state), time.time())
        ).fetchone()
        db.execute("DELETE FROM login_states WHERE hash=?", (digest(state),))
    if not saved:
        return failed
    try:
        user = await github_identity(code, saved[0])
    except (httpx.HTTPError, ValueError, KeyError):
        return failed
    # Rotate any existing session rather than retaining a fixation target.
    with auth_db() as db:
        db.execute("DELETE FROM sessions WHERE hash=?", (digest(request.cookies.get(COOKIE, "")),))
    token = issue_session(user)
    response = RedirectResponse("/", status_code=303)
    response.delete_cookie(STATE_COOKIE, secure=True, httponly=True, samesite="lax", path="/")
    response.set_cookie(
        COOKIE, token, max_age=SESSION_SECONDS, secure=True, httponly=True, samesite="lax", path="/"
    )
    return response


@router.post("/api/auth/logout")
def logout(request: Request):
    if enabled():
        with auth_db() as db:
            db.execute("DELETE FROM sessions WHERE hash=?", (digest(request.cookies.get(COOKIE, "")),))
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE, secure=True, httponly=True, samesite="lax", path="/")
    return response


class BodyLimit:
    """Cap streamed uploads as well as Content-Length before multipart parsing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not enabled() or scope["method"] in {"GET", "HEAD", "OPTIONS"}:
            return await self.app(scope, receive, send)
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > 11_000_000:
                return await failure("Upload too large. Choose a smaller file.", 413)(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body"):
                break

        async def replay():
            return chunks.pop(0) if chunks else await receive()

        await self.app(scope, replay, send)
