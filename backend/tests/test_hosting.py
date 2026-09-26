import hashlib
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from backend import hosting, main, store


@pytest.fixture
def hosted(tmp_path, monkeypatch):
    monkeypatch.setenv("SPENDSHIELD_MODE", "hosted")
    monkeypatch.setenv("SPENDSHIELD_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PUBLIC_ORIGIN", "https://spendshield.example")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test-client")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "private-test-secret")
    monkeypatch.setenv("GEMINI_API_KEY", "private-test-gemini")
    monkeypatch.delenv("SPENDSHIELD_ENABLE_DEMO", raising=False)
    with TestClient(main.app, base_url="https://spendshield.example") as client:
        yield client


def sign_in(client, user="alice"):
    token = hosting.issue_session(hashlib.sha256(user.encode()).hexdigest())
    client.cookies.set(hosting.COOKIE, token, domain="spendshield.example", path="/")
    client.headers.update({"Origin": "https://spendshield.example", "X-SpendShield": "1"})
    return token


def setup(client, name):
    return client.post(
        "/api/profile/setup",
        json={
            "name": name,
            "budget": "500",
            "goal_name": "Emergency fund",
            "goal_target": "1500",
            "goal_saved": "200",
            "goal_monthly": "100",
            "ai_enabled": False,
        },
    )


def test_anonymous_cannot_read_write_or_call_ai(hosted):
    assert hosted.get("/api/auth/session").json() == {"hosted": True, "authenticated": False}
    assert hosted.get("/api/dashboard").status_code == 401
    hosted.headers.update({"Origin": "https://spendshield.example", "X-SpendShield": "1"})
    assert hosted.post("/api/ai/analyze-purchase", json={"text": "shoes"}).status_code == 401
    assert hosted.get("/api/profile/export").status_code == 401
    assert hosted.get("/openapi.json").status_code == 404
    assert hosted.post("/api/demo/reset").status_code == 404
    assert hosted.get("/api/health", headers={"Host": "attacker.example"}).status_code == 403
    with pytest.raises(RuntimeError, match="authenticated"):
        with store.connection():
            pass


def test_user_data_purchase_ids_and_backups_are_isolated(hosted):
    alice = sign_in(hosted)
    assert setup(hosted, "Alice").status_code == 200
    p = hosted.post(
        "/api/ai/analyze-purchase", json={"text": "Shoes", "price": "160", "use_ai": False}
    ).json()
    backup = hosted.get("/api/profile/export").text
    assert "private-test" not in backup
    sign_in(hosted, "bob")
    assert not hosted.get("/api/dashboard").json()["profile"]["onboarded"]
    assert setup(hosted, "Bob").status_code == 200
    assert hosted.post(f"/api/purchases/{p['id']}/confirm-price", json={"price": "1"}).status_code == 404
    assert hosted.get("/api/purchases/pending").json() == []
    assert hosted.get("/api/profile/recovery").json() == {"available": False}
    hosted.cookies.set(hosting.COOKIE, alice, domain="spendshield.example", path="/")
    assert hosted.get("/api/dashboard").json()["profile"]["name"] == "Alice"
    assert hosted.get("/api/purchases/pending").json()[0]["id"] == p["id"]


def test_csrf_logout_and_response_headers(hosted):
    token = sign_in(hosted)
    assert hosted.post("/api/auth/logout", headers={"Origin": "https://evil.example"}).status_code == 403
    assert hosted.post("/api/auth/logout", headers={"X-SpendShield": ""}).status_code == 403
    response = hosted.get("/api/dashboard")
    assert response.headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert hosted.post("/api/auth/logout").status_code == 200
    hosted.cookies.set(hosting.COOKIE, token, domain="spendshield.example", path="/")
    assert hosted.get("/api/dashboard").status_code == 401


def test_oauth_pkce_state_replay_and_secure_cookies(hosted, monkeypatch):
    seen = []

    async def fake_identity(code, verifier):
        seen.append((code, verifier))
        return hashlib.sha256(b"alice").hexdigest()

    monkeypatch.setattr(hosting, "github_identity", fake_identity)
    response = hosted.get("/auth/login", follow_redirects=False)
    query = parse_qs(urlsplit(response.headers["location"]).query)
    assert query["code_challenge_method"] == ["S256"]
    assert "repo" not in query.get("scope", [])
    state = query["state"][0]
    assert "HttpOnly" in response.headers["set-cookie"] and "Secure" in response.headers["set-cookie"]
    failed = hosted.get("/auth/callback?state=wrong&code=abc", follow_redirects=False)
    assert "signin=failed" in failed.headers["location"]
    assert not seen
    hosted.cookies.set(hosting.STATE_COOKIE, state, domain="spendshield.example", path="/")
    result = hosted.get(f"/auth/callback?state={state}&code=abc", follow_redirects=False)
    assert result.headers["location"] == "/"
    assert len(seen) == 1 and len(seen[0][1]) >= 43
    assert hosted.get("/api/auth/session").json()["authenticated"]
    hosted.cookies.set(hosting.STATE_COOKIE, state, domain="spendshield.example", path="/")
    assert (
        "signin=failed"
        in hosted.get(f"/auth/callback?state={state}&code=abc", follow_redirects=False).headers["location"]
    )
    assert len(seen) == 1


def test_ai_limits_persist_and_do_not_block_records(hosted, monkeypatch):
    sign_in(hosted)
    setup(hosted, "Alice")
    monkeypatch.setenv("AI_USER_DAILY_LIMIT", "1")
    body = {"text": "Shoes", "price": "160", "use_ai": False}
    assert hosted.post("/api/ai/analyze-purchase", json=body).status_code == 200
    assert hosted.post("/api/ai/analyze-purchase", json=body).status_code == 429
    assert hosted.get("/api/dashboard").status_code == 200
    sign_in(hosted, "bob")
    assert hosted.post("/api/ai/analyze-purchase", json=body).status_code == 200


def test_streamed_upload_limit(hosted):
    sign_in(hosted)
    response = hosted.post("/api/transactions/upload", content=iter([b"x" * 6_000_000, b"x" * 6_000_000]))
    assert response.status_code == 413


def test_hosted_startup_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setenv("SPENDSHIELD_MODE", "hosted")
    monkeypatch.setenv("SPENDSHIELD_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("GITHUB_CLIENT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="Hosted mode requires"):
        hosting.initialize()
