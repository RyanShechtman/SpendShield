import io
from PIL import Image
from backend import main
from backend.models import PurchaseUnderstanding


def purchase(client, price="160", **extra):
    return client.post(
        "/api/ai/analyze-purchase",
        json={"text": "Aero Run running shoes", "price": price, "use_ai": False, **extra},
    ).json()


def test_health_and_demo(client):
    assert client.get("/api/health").json()["status"] == "ok"
    d = client.get("/api/dashboard").json()
    assert d["income"] == 3200
    assert d["available"] == 372
    assert d["expenses"] == 2096.97
    assert d["savings_rate"] == 9.4
    assert d["goal"]["saved"] == 920
    assert d["money_rescued"]["this_month"] == 214
    assert len(d["subscriptions"]) == 3
    assert client.get("/api/gemini/status").json()["status"] == "unavailable"


def test_full_demo_and_atomic_duplicate_protection(client):
    p = purchase(client)
    assert p["impact"]["delay_days"] == 9
    assert p["ai"]["status"] != "live"
    body = {"purchase_id": p["id"], "action": "cheaper_alternative_selected", "alternative_id": "stride-87"}
    response = client.post("/api/purchases/protect", json=body)
    assert response.status_code == 200
    result = response.json()
    assert result["protected"] == 73
    assert result["dashboard"]["goal"]["saved"] == 993
    assert result["dashboard"]["money_rescued"]["this_month"] == 287
    assert result["dashboard"]["money_rescued"]["projected_annual_recurring"] == 168
    assert client.post("/api/purchases/protect", json=body).status_code == 409
    assert client.post(f"/api/purchases/{p['id']}/confirm-price", json={"price": "1"}).status_code == 409
    assert client.get("/api/dashboard").json()["goal"]["saved"] == 993
    assert client.post("/api/demo/reset").json()["goal"]["saved"] == 920


def test_missing_price_and_bad_alternative(client):
    p = purchase(client, price=None)
    assert p["impact"] is None
    assert (
        client.post(
            "/api/purchases/protect", json={"purchase_id": p["id"], "action": "purchase_skipped"}
        ).status_code
        == 400
    )
    assert client.post(f"/api/purchases/{p['id']}/confirm-price", json={"price": "160"}).status_code == 200
    assert (
        client.post(
            "/api/purchases/protect",
            json={"purchase_id": p["id"], "action": "cheaper_alternative_selected", "alternative_id": "fake"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/purchases/protect", json={"purchase_id": p["id"], "action": "purchase_skipped"}
        ).json()["protected"]
        == 160
    )


def test_guard_voluntary_limits_and_cooldown(client):
    assert client.post("/api/gambling/cooldown").status_code == 400
    assert (
        client.post("/api/gambling/settings", json={"enabled": True, "weekly_limit": "100"}).status_code
        == 200
    )
    g = client.get("/api/gambling/status?proposed=40").json()
    assert g["over_by"] == 25
    assert g["impact"]["delay_days"] == 2
    assert client.post("/api/gambling/cooldown").json()["cooldown_active"]
    client.post("/api/gambling/settings", json={"enabled": True, "weekly_limit": "200"})
    assert client.get("/api/gambling/status?proposed=40").json()["over_by"] == 0
    assert (
        client.post("/api/gambling/settings", json={"enabled": True, "weekly_limit": "0"}).status_code == 400
    )


def test_upload_is_atomic_and_preserves_profile(client):
    before = client.get("/api/transactions").json()
    assert client.post("/api/transactions/upload", files={"file": ("bad.csv", b"no")}).status_code == 400
    assert client.get("/api/transactions").json() == before
    result = client.post(
        "/api/transactions/upload",
        files={"file": ("good.csv", b"date,merchant,amount\n2026-01-01,Payroll,1000\n2026-01-02,Store,-20")},
    )
    assert result.status_code == 200
    d = client.get("/api/dashboard").json()
    assert d["profile"]["name"] == "Alex Morgan"
    assert d["goal"]["saved"] == 920
    assert d["available"] == 372
    assert d["transaction_count"] == len(before["transactions"]) + 2


def test_subscriptions_and_goal_settings(client):
    body = {"merchant": "Spotify"}
    result = client.post("/api/subscriptions/confirm-cancelled", json=body).json()
    assert result["protected"] == 11.99
    assert result["dashboard"]["money_rescued"]["projected_annual_recurring"] == 311.88
    assert client.post("/api/subscriptions/confirm-cancelled", json=body).status_code == 409
    goal = client.post(
        "/api/goals",
        json={"name": "Move", "target": "2000", "current_saved": "100", "monthly_contribution": "0"},
    ).json()
    assert goal["saved"] == 100
    assert goal["days"] is None


def test_image_failures_and_mocked_multimodal(client, monkeypatch):
    assert (
        client.post(
            "/api/ai/analyze-purchase-image", files={"file": ("bad.png", b"not an image")}
        ).status_code
        == 400
    )
    buffer = io.BytesIO()
    Image.new("RGB", (30, 30)).save(buffer, format="PNG")
    image = buffer.getvalue()
    assert (
        client.post("/api/ai/analyze-purchase-image", files={"file": ("cart.png", image)}).status_code == 503
    )

    async def fake_generate(schema, prompt, image=None, mime=None):
        assert image is not None and mime == "image/png"
        return PurchaseUnderstanding(
            product_name="Aero Run shoes",
            detected_price=160,
            category="Shopping",
            confidence="high",
            summary="A useful everyday option.",
            tradeoffs=["Consider fit."],
            alternative_queries=[],
            cooldown_recommendation=48,
            explanation="Your recorded budget is used.",
        ), {"status": "live", "model": "test-model", "message": "Mock"}

    monkeypatch.setattr(main.gemini, "generate", fake_generate)
    p = client.post("/api/ai/analyze-purchase-image", files={"file": ("cart.png", image)}).json()
    assert p["detected_price"] == 160
    assert p["ai"]["model"] == "test-model"
    assert not p["price_confirmed"]
    assert p["impact"]["delay_days"] == 9


def test_wait_and_scan_offline(client):
    p = purchase(client)
    assert client.post(f"/api/purchases/{p['id']}/wait").json()["wait_until"]
    assert len(client.get("/api/purchases/pending").json()) == 1
    result = client.post("/api/ai/financial-scan").json()
    assert result["ai"]["status"] == "unavailable"
    assert result["insights"][0]["estimated_monthly_savings"] == 43.97


def test_local_security_boundary(client):
    assert client.post("/api/demo/reset", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 403
    assert client.get("/api/dashboard").headers["Cache-Control"] == "no-store"
